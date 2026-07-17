import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseVillageExport } from "../../collector/src/village-export.ts";
import { closeDatabase, exportVillageHistories, importVillageHistory, migrate } from "../index.ts";
import type { VillageHistoryBundle } from "../index.ts";

type LegacyBundle = {
  format: "multi-coc-village-history"; version: 1; exportedAt: string;
  account: VillageHistoryBundle["account"];
  villageExports: Array<{ playerTag: string; exportedAt: string; raw: unknown; normalized?: VillageHistoryBundle["villageExports"][number]["normalized"] }>;
  upgradeSettings?: VillageHistoryBundle["upgradeSettings"];
};

const [command, target = ".local/village-history", selector] = process.argv.slice(2);

function filename(bundle: VillageHistoryBundle): string {
  const identity = bundle.account.playerTag.replace(/^#/, "") || bundle.account.id;
  return `${identity.replace(/[^a-z0-9_-]/gi, "_")}.jsonl`;
}

async function files(targetPath: string): Promise<string[]> {
  const info = await stat(targetPath);
  if (info.isFile()) return [targetPath];
  if (!info.isDirectory()) throw new Error(`${targetPath} is not a file or directory`);
  return (await readdir(targetPath)).filter((name) => name.endsWith(".jsonl") || name.endsWith(".json")).sort().map((name) => path.join(targetPath, name));
}

function parseRaw(raw: unknown, exportedAt: string) {
  const parsed = parseVillageExport(raw, { now: new Date(exportedAt).getTime() });
  if (parsed.exportedAt !== exportedAt) throw new Error(`export timestamp mismatch: ${exportedAt}`);
  return parsed;
}

function canonicalizeSettings(bundle: VillageHistoryBundle): VillageHistoryBundle {
  const keyMap = new Map<string, string>();
  for (const item of bundle.villageExports) {
    const reparsed = parseRaw(item.raw, item.exportedAt);
    for (const oldUpgrade of item.normalized.upgrades || []) {
      const match = reparsed.upgrades.find((upgrade) =>
        upgrade.name === oldUpgrade.name && upgrade.type === oldUpgrade.type && upgrade.base === oldUpgrade.base
        && upgrade.nextLevel === oldUpgrade.nextLevel && upgrade.finishAt === oldUpgrade.finishAt);
      if (match) keyMap.set(oldUpgrade.id, match.id);
    }
  }
  return {
    ...bundle,
    upgradeSettings: bundle.upgradeSettings.map((setting) => ({ ...setting, sourceKey: keyMap.get(setting.sourceKey) || setting.sourceKey })),
  };
}

async function readBundle(source: string): Promise<VillageHistoryBundle> {
  const text = await readFile(source, "utf8");
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`empty village history: ${source}`);
  const firstRecord = JSON.parse(trimmed.split(/\r?\n/, 1)[0]) as Record<string, unknown>;
  if (firstRecord.format === "multi-coc-village-history") {
    const legacy = JSON.parse(trimmed) as LegacyBundle;
    if (legacy.version !== 1 || !legacy.account?.label || !Array.isArray(legacy.villageExports)) throw new Error(`invalid v1 village history: ${source}`);
    return canonicalizeSettings({
      format: "multi-coc-village-exports", version: 2, exportedAt: legacy.exportedAt,
      account: legacy.account,
      villageExports: legacy.villageExports.map((item) => ({ ...item, normalized: item.normalized || parseRaw(item.raw, item.exportedAt) })),
      upgradeSettings: (legacy.upgradeSettings || []).filter((item) => item.source === "export"),
    });
  }
  const records = trimmed.split(/\r?\n/).map((line, index) => {
    try { return JSON.parse(line) as Record<string, unknown>; }
    catch { throw new Error(`invalid JSON on line ${index + 1}: ${source}`); }
  });
  const header = records.shift();
  if (header?.record !== "village" || header.format !== "multi-coc-village-exports" || header.version !== 2 || typeof header.exportedAt !== "string" || !header.account) {
    throw new Error(`invalid v2 village history header: ${source}`);
  }
  const account = header.account as VillageHistoryBundle["account"];
  const villageExports = records.map((record, index) => {
    if (record.record !== "export" || typeof record.exportedAt !== "string" || !("raw" in record)) throw new Error(`invalid export record on line ${index + 2}: ${source}`);
    const normalized = parseRaw(record.raw, record.exportedAt);
    if (account.playerTag && normalized.tag !== account.playerTag) throw new Error(`player tag mismatch on line ${index + 2}: ${source}`);
    return { playerTag: normalized.tag, exportedAt: record.exportedAt, raw: record.raw, normalized };
  });
  for (let index = 1; index < villageExports.length; index += 1) {
    if (villageExports[index - 1].exportedAt >= villageExports[index].exportedAt) throw new Error(`exports are not strictly chronological: ${source}`);
  }
  return {
    format: "multi-coc-village-exports", version: 2, exportedAt: header.exportedAt,
    account, villageExports,
    upgradeSettings: Array.isArray(header.upgradeSettings) ? header.upgradeSettings as VillageHistoryBundle["upgradeSettings"] : [],
  };
}

function serialize(bundle: VillageHistoryBundle): string {
  const header = { record: "village", format: bundle.format, version: bundle.version, exportedAt: bundle.exportedAt, account: bundle.account, upgradeSettings: bundle.upgradeSettings };
  return [header, ...bundle.villageExports.map((item) => ({ record: "export", exportedAt: item.exportedAt, raw: item.raw }))]
    .map((record) => JSON.stringify(record)).join("\n") + "\n";
}

await migrate();
try {
  if (command === "export") {
    const bundles = await exportVillageHistories(selector);
    if (selector && bundles.length === 0) throw new Error(`village not found: ${selector}`);
    await mkdir(target, { recursive: true });
    const expectedFiles = new Set(bundles.map(filename));
    for (const bundle of bundles) {
      const destination = path.join(target, filename(bundle));
      const temporary = `${destination}.${process.pid}.tmp`;
      await writeFile(temporary, serialize(canonicalizeSettings(bundle)), "utf8");
      await rename(temporary, destination);
      console.log(`[history] exported ${bundle.account.label} (${bundle.account.playerTag || bundle.account.id}) -> ${destination}`);
    }
    if (!selector) {
      for (const name of (await readdir(target)).filter((item) => (item.endsWith(".jsonl") || item.endsWith(".json")) && !expectedFiles.has(item))) {
        const candidate = path.join(target, name);
        try {
          const first = (await readFile(candidate, "utf8")).trimStart();
          if (first.includes('"multi-coc-village-exports"') || first.includes('"multi-coc-village-history"')) await unlink(candidate);
        } catch { /* Never remove unrelated files. */ }
      }
    }
    console.log(`[history] exported villages=${bundles.length}`);
  } else if (command === "import") {
    let villages = 0; let villageExports = 0;
    for (const source of await files(target)) {
      const result = await importVillageHistory(await readBundle(source));
      villages += 1; villageExports += result.villageExports;
      console.log(`[history] imported ${result.label} created=${result.created} exports=${result.villageExports}`);
    }
    console.log(`[history] imported villages=${villages} exports=${villageExports}`);
  } else if (command === "validate") {
    const sources = await files(target);
    if (!sources.length) throw new Error(`no village history files found: ${target}`);
    for (const source of sources) await readBundle(source);
    console.log(`[history] valid villages=${sources.length}`);
  } else throw new Error("usage: village-history.ts <export|import|validate> [path] [village-id|tag|label]");
} finally { await closeDatabase(); }
