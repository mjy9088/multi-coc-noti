import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  closeDatabase, exportVillageHistories, importVillageHistory, migrate,
} from "../packages/database/index.ts";
import type { VillageHistoryBundle } from "../packages/database/index.ts";

const [command, target = ".local/village-history", selector] = process.argv.slice(2);

function filename(bundle: VillageHistoryBundle): string {
  const identity = bundle.account.playerTag.replace(/^#/, "") || bundle.account.id;
  return `${identity.replace(/[^a-z0-9_-]/gi, "_")}.json`;
}

async function files(targetPath: string): Promise<string[]> {
  const info = await stat(targetPath);
  if (info.isFile()) return [targetPath];
  if (!info.isDirectory()) throw new Error(`${targetPath} is not a file or directory`);
  return (await readdir(targetPath)).filter((name) => name.endsWith(".json")).sort().map((name) => path.join(targetPath, name));
}

async function readBundle(source: string): Promise<VillageHistoryBundle> {
  const bundle = JSON.parse(await readFile(source, "utf8")) as VillageHistoryBundle;
  if (bundle.format !== "multi-coc-village-history" || bundle.version !== 1 || !bundle.account?.label || !Array.isArray(bundle.snapshots) || !Array.isArray(bundle.villageExports)) {
    throw new Error(`invalid village history bundle: ${source}`);
  }
  return bundle;
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
      await writeFile(temporary, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
      await rename(temporary, destination);
      console.log(`[history] exported ${bundle.account.label} (${bundle.account.playerTag || bundle.account.id}) -> ${destination}`);
    }
    if (!selector) {
      for (const name of (await readdir(target)).filter((item) => item.endsWith(".json") && !expectedFiles.has(item))) {
        const candidate = path.join(target, name);
        try {
          const value = JSON.parse(await readFile(candidate, "utf8")) as Partial<VillageHistoryBundle>;
          if (value.format === "multi-coc-village-history") await unlink(candidate);
        } catch {
          // Never remove unrelated or invalid JSON files from the backup directory.
        }
      }
    }
    console.log(`[history] exported villages=${bundles.length}`);
  } else if (command === "import") {
    let villages = 0; let snapshots = 0; let villageExports = 0;
    for (const source of await files(target)) {
      const bundle = await readBundle(source);
      const result = await importVillageHistory(bundle);
      villages += 1; snapshots += result.snapshots; villageExports += result.villageExports;
      console.log(`[history] imported ${result.label} created=${result.created} snapshots=${result.snapshots} exports=${result.villageExports}`);
    }
    console.log(`[history] imported villages=${villages} snapshots=${snapshots} exports=${villageExports}`);
  } else if (command === "validate") {
    const sources = await files(target);
    if (!sources.length) throw new Error(`no village history files found: ${target}`);
    for (const source of sources) await readBundle(source);
    console.log(`[history] valid villages=${sources.length}`);
  } else {
    throw new Error("usage: village-history.ts <export|import|validate> [path] [village-id|tag|label]");
  }
} finally {
  await closeDatabase();
}
