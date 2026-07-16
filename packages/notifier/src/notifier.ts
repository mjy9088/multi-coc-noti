import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir, readJson, writeJson } from "@multi-coc/shared";
import type { VillageEvent } from "@multi-coc/shared";

export type NotifierConfig = {
  eventFile: string | null; eventDir: string; stateFile: string; intervalMs: number;
  barkBase: string; deviceKey: string; locale: "ko" | "en"; group: string; icon?: string;
};

export function notifierConfig(env: NodeJS.ProcessEnv = process.env): NotifierConfig {
  const root = env.DATA_DIR || dataDir();
  const deviceKey = env.BARK_DEVICE_KEY;
  if (!deviceKey) throw new Error("BARK_DEVICE_KEY is required");
  return {
    eventFile: env.EVENTS_FILE || null,
    eventDir: path.join(root, "events"),
    stateFile: env.NOTIFIER_STATE_FILE || path.join(root, "notifier", "state.json"),
    intervalMs: Number(env.NOTIFIER_INTERVAL_SECONDS || 10) * 1000,
    barkBase: (env.BARK_BASE_URL || "https://api.day.app").replace(/\/$/, ""),
    deviceKey,
    locale: env.NOTIFICATION_LOCALE === "en" ? "en" : "ko",
    group: env.BARK_GROUP || "Clash Upgrades",
    icon: env.BARK_ICON || undefined,
  };
}

export function localizeEvent(event: VillageEvent, locale: "ko" | "en"): { title: string; body: string } {
  if (locale !== "en") return { title: event.title, body: event.body };
  const upgrade = event.data?.upgrade;
  return {
    title: event.type === "upgrade.completed" ? `${event.accountName} upgrade complete` : `${event.accountName}: builder available`,
    body: event.type === "upgrade.completed" && upgrade
      ? `${upgrade.name} level ${upgrade.nextLevel || upgrade.level + 1} is complete.`
      : `${event.data?.free || 1} builder(s) are now available.`,
  };
}

export async function sendBark(event: VillageEvent, config: NotifierConfig, fetchImpl: typeof fetch = fetch): Promise<void> {
  const localized = localizeEvent(event, config.locale);
  const url = new URL(`${config.barkBase}/${encodeURIComponent(config.deviceKey)}`);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: localized.title,
      body: localized.body,
      group: config.group,
      icon: config.icon,
      sound: event.type === "upgrade.completed" ? "minuet" : "bell",
      level: "active",
    }),
  });
  if (!response.ok) throw new Error(`Bark HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

export async function runOnce(config: NotifierConfig, { fetchImpl = fetch, logger = console }: { fetchImpl?: typeof fetch; logger?: Pick<Console, "log"> } = {}): Promise<{ delivered: number; known: number }> {
  const state = await readJson<{ delivered: string[] }>(config.stateFile, { delivered: [] });
  const delivered = new Set<string>(state.delivered || []);
  let eventFiles = config.eventFile ? [config.eventFile] : [];
  if (!config.eventFile) {
    try {
      eventFiles = (await readdir(config.eventDir)).filter((name) => /^(?:\d{4}-\d{2}-\d{2}|events)\.jsonl$/.test(name)).sort().map((name) => path.join(config.eventDir, name));
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  let deliveredNow = 0;
  for (const eventFile of eventFiles) {
    const content = await readFile(eventFile, "utf8");
    for (const line of content.trim().split(/\r?\n/).filter(Boolean)) {
      const event = JSON.parse(line) as VillageEvent;
      if (!event.id || delivered.has(event.id)) continue;
      await sendBark(event, config, fetchImpl);
      delivered.add(event.id);
      deliveredNow += 1;
      logger.log(`[notifier] delivered ${event.id}`);
      await writeJson(config.stateFile, { delivered: [...delivered].slice(-5000), updatedAt: new Date().toISOString() });
    }
  }
  return { delivered: deliveredNow, known: delivered.size };
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

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) startNotifier();
