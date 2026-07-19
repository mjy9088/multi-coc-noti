import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DueChannelDelivery, DueNotification } from "@multi-coc/database";
import { claimDueChannelDeliveries, markChannelDeliveryFailed, markChannelDeliverySent } from "@multi-coc/database";

export type NotifierConfig = {
  barkBase: string;
  deviceKey: string;
  locale: "ko" | "en";
  group: string;
  icon?: string;
  deliveryRules?: Partial<Record<DeliverableNotificationKind, Partial<BarkDeliveryRule>>>;
};
export type NotifierRuntimeConfig = { intervalMs: number };

export type DeliverableNotificationKind = Exclude<DueNotification["kind"], "legacy">;
export type BarkInterruptionLevel = "passive" | "active" | "timeSensitive" | "critical";
export type BarkDeliveryRule = {
  enabled: boolean;
  sound: string | null;
  interruptionLevel: BarkInterruptionLevel;
  criticalVolume: number | null;
  repeatSound: boolean;
  groupName: string | null;
  targetUrl: string | null;
  archive: boolean | null;
  archiveTtlSeconds: number | null;
};

export type BarkPayload = {
  title: string;
  body: string;
  group?: string;
  icon?: string;
  sound?: string;
  level: BarkInterruptionLevel;
  volume?: number;
  call?: "1";
  url?: string;
  isArchive?: "0" | "1";
  ttl?: number;
};

export function notifierConfig(env: NodeJS.ProcessEnv = process.env): NotifierRuntimeConfig {
  return {
    intervalMs: Number(env.NOTIFIER_INTERVAL_SECONDS || 10) * 1000,
  };
}

export function localizeNotification(
  notification: DueNotification,
  locale: "ko" | "en",
): { title: string; body: string } {
  if (notification.kind === "refresh_required")
    return locale === "en"
      ? {
          title: `${notification.accountName}: village update required`,
          body: `${notification.upgradeName} completed more than 24 hours ago. Paste fresh village data to update available slots.`,
        }
      : {
          title: `${notification.accountName} 마을 업데이트 필요`,
          body: `${notification.upgradeName} 완료 후 24시간이 지났습니다. 최신 마을 데이터를 붙여넣어 주세요.`,
        };
  const complete = notification.kind === "completion";
  const resource = notification.kind === "resource_preparation";
  if (locale === "en")
    return {
      title: complete
        ? `${notification.accountName} upgrade complete`
        : resource
          ? `${notification.accountName}: prepare resources`
          : `${notification.accountName} upgrade reminder`,
      body: complete
        ? `${notification.upgradeName} level ${notification.nextLevel} is complete.`
        : resource
          ? `Prepare resources now. ${notification.upgradeName} level ${notification.nextLevel} completes in about ${notification.minutesRemaining} minute(s).`
          : `${notification.upgradeName} level ${notification.nextLevel} completes in 1 minute.`,
    };
  return {
    title: complete
      ? `${notification.accountName} 업그레이드 완료`
      : resource
        ? `${notification.accountName} 자원을 미리 준비하세요!`
        : `${notification.accountName} 업그레이드 알림`,
    body: complete
      ? `${notification.upgradeName} 레벨 ${notification.nextLevel} 완료`
      : resource
        ? `${notification.upgradeName} 레벨 ${notification.nextLevel} 완료까지 약 ${notification.minutesRemaining}분 남았습니다.`
        : `${notification.upgradeName} 레벨 ${notification.nextLevel} 완료 1분 전`,
  };
}

export function resolveBarkDeliveryRule(
  kind: DueNotification["kind"],
  config: Pick<NotifierConfig, "group" | "deliveryRules">,
): BarkDeliveryRule {
  const override = kind === "legacy" ? undefined : config.deliveryRules?.[kind];
  return {
    enabled: override?.enabled ?? true,
    sound: override?.sound ?? (kind === "completion" ? "minuet" : "bell"),
    interruptionLevel: override?.interruptionLevel ?? "active",
    criticalVolume: override?.criticalVolume ?? null,
    repeatSound: override?.repeatSound ?? false,
    groupName: override?.groupName ?? config.group,
    targetUrl: override?.targetUrl ?? null,
    archive: override?.archive ?? null,
    archiveTtlSeconds: override?.archiveTtlSeconds ?? null,
  };
}

export function buildBarkPayload(
  notification: DueNotification,
  config: Pick<NotifierConfig, "locale" | "group" | "icon" | "deliveryRules">,
): BarkPayload | null {
  const localized = localizeNotification(notification, config.locale);
  const rule = resolveBarkDeliveryRule(notification.kind, config);
  if (!rule.enabled) return null;
  return {
    title: localized.title,
    body: localized.body,
    level: rule.interruptionLevel,
    ...(rule.groupName ? { group: rule.groupName } : {}),
    ...(config.icon ? { icon: config.icon } : {}),
    ...(rule.sound ? { sound: rule.sound } : {}),
    ...(rule.interruptionLevel === "critical" && rule.criticalVolume !== null ? { volume: rule.criticalVolume } : {}),
    ...(rule.repeatSound ? { call: "1" as const } : {}),
    ...(rule.targetUrl ? { url: rule.targetUrl } : {}),
    ...(rule.archive !== null ? { isArchive: rule.archive ? ("1" as const) : ("0" as const) } : {}),
    ...(rule.archive === true && rule.archiveTtlSeconds !== null ? { ttl: rule.archiveTtlSeconds } : {}),
  };
}

export async function sendBark(
  notification: DueNotification,
  config: NotifierConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const payload = buildBarkPayload(notification, config);
  if (!payload) return;
  const response = await fetchImpl(new URL(`${config.barkBase}/${encodeURIComponent(config.deviceKey)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Bark HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

type NotificationStore = {
  claimChannels: typeof claimDueChannelDeliveries;
  channelSent: typeof markChannelDeliverySent;
  channelFailed: typeof markChannelDeliveryFailed;
};

const databaseStore: NotificationStore = {
  claimChannels: claimDueChannelDeliveries,
  channelSent: markChannelDeliverySent,
  channelFailed: markChannelDeliveryFailed,
};

function channelConfig(delivery: DueChannelDelivery): NotifierConfig {
  const deliveryRules =
    delivery.kind === "legacy"
      ? undefined
      : {
          [delivery.kind]: delivery.rule,
        };
  return {
    barkBase: delivery.channel.baseUrl.replace(/\/$/, ""),
    deviceKey: delivery.channel.deviceKey,
    locale: delivery.channel.locale,
    group: delivery.channel.defaultGroup ?? "Clash Upgrades",
    icon: delivery.channel.iconUrl ?? undefined,
    deliveryRules,
  };
}

export async function runOnce({
  fetchImpl = fetch,
  logger = console,
  store = databaseStore,
}: {
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, "log" | "error">;
  store?: NotificationStore;
} = {}): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  const channelDeliveries = (await store.claimChannels()) ?? [];
  for (const delivery of channelDeliveries) {
    try {
      await sendBark(delivery, channelConfig(delivery), fetchImpl);
      await store.channelSent(delivery.deliveryId);
      delivered += 1;
      logger.log(`[notifier] delivered channel delivery ${delivery.deliveryId}`);
    } catch (error) {
      failed += 1;
      await store.channelFailed(delivery.deliveryId, (error as Error).message);
      logger.error(`[notifier] channel delivery ${delivery.deliveryId}: ${(error as Error).message}`);
    }
  }
  return { delivered, failed };
}

export function startNotifier(config = notifierConfig()): NodeJS.Timeout {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (error) {
      console.error(`[notifier] ${(error as Error).message}`);
    } finally {
      running = false;
    }
  };
  run();
  return setInterval(run, config.intervalMs);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startNotifier();
}
