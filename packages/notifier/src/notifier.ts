import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  claimDueNotifications, markNotificationFailed, markNotificationSent,
} from "@multi-coc/database";
import type { DueNotification } from "@multi-coc/database";

export type NotifierConfig = {
  intervalMs: number; barkBase: string; deviceKey: string;
  locale: "ko" | "en"; group: string; icon?: string;
};

export function notifierConfig(env: NodeJS.ProcessEnv = process.env): NotifierConfig {
  const deviceKey = env.BARK_DEVICE_KEY;
  if (!deviceKey) throw new Error("BARK_DEVICE_KEY is required");
  return {
    intervalMs: Number(env.NOTIFIER_INTERVAL_SECONDS || 10) * 1000,
    barkBase: (env.BARK_BASE_URL || "https://api.day.app").replace(/\/$/, ""),
    deviceKey,
    locale: env.NOTIFICATION_LOCALE === "en" ? "en" : "ko",
    group: env.BARK_GROUP || "Clash Upgrades",
    icon: env.BARK_ICON || undefined,
  };
}

export function localizeNotification(notification: DueNotification, locale: "ko" | "en"): { title: string; body: string } {
  const complete = notification.minutesBefore === 0;
  if (locale === "en") return {
    title: complete ? `${notification.accountName} upgrade complete` : `${notification.accountName} upgrade reminder`,
    body: complete
      ? `${notification.upgradeName} level ${notification.nextLevel} is complete.`
      : `${notification.upgradeName} level ${notification.nextLevel} completes in ${notification.minutesBefore} minute(s).`,
  };
  return {
    title: complete ? `${notification.accountName} 업그레이드 완료` : `${notification.accountName} 업그레이드 알림`,
    body: complete
      ? `${notification.upgradeName} 레벨 ${notification.nextLevel} 완료`
      : `${notification.upgradeName} 레벨 ${notification.nextLevel} 완료 ${notification.minutesBefore}분 전`,
  };
}

export async function sendBark(notification: DueNotification, config: NotifierConfig, fetchImpl: typeof fetch = fetch): Promise<void> {
  const localized = localizeNotification(notification, config.locale);
  const response = await fetchImpl(new URL(`${config.barkBase}/${encodeURIComponent(config.deviceKey)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: localized.title, body: localized.body, group: config.group, icon: config.icon,
      sound: notification.minutesBefore === 0 ? "minuet" : "bell", level: "active",
    }),
  });
  if (!response.ok) throw new Error(`Bark HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

type NotificationStore = {
  claim: typeof claimDueNotifications; sent: typeof markNotificationSent; failed: typeof markNotificationFailed;
};

const databaseStore: NotificationStore = { claim: claimDueNotifications, sent: markNotificationSent, failed: markNotificationFailed };

export async function runOnce(config: NotifierConfig, {
  fetchImpl = fetch, logger = console, store = databaseStore,
}: { fetchImpl?: typeof fetch; logger?: Pick<Console, "log" | "error">; store?: NotificationStore } = {}): Promise<{ delivered: number; failed: number }> {
  const notifications = await store.claim();
  let delivered = 0; let failed = 0;
  for (const notification of notifications) {
    try {
      await sendBark(notification, config, fetchImpl);
      await store.sent(notification.id);
      delivered += 1;
      logger.log(`[notifier] delivered notification ${notification.id}`);
    } catch (error) {
      failed += 1;
      await store.failed(notification.id, (error as Error).message);
      logger.error(`[notifier] notification ${notification.id}: ${(error as Error).message}`);
    }
  }
  return { delivered, failed };
}

export function startNotifier(config = notifierConfig()): NodeJS.Timeout {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await runOnce(config); } catch (error) { console.error(`[notifier] ${(error as Error).message}`); } finally { running = false; }
  };
  run();
  return setInterval(run, config.intervalMs);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startNotifier();
}
