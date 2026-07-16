import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const idPattern = /\[([A-Z]+(?:-[A-Z]+)*-\d{3})\]/g;
const declarationPattern = /<!-- contract: ([A-Z]+(?:-[A-Z]+)*-\d{3}) -->/g;

async function testFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(target);
    return entry.name.endsWith(".test.ts") ? [target] : [];
  }));
  return nested.flat();
}

test("[TEST-DOC-001] keeps regression test IDs synchronized with the contract document", async () => {
  const files = await testFiles(path.join(root, "packages"));
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const testIds = new Set(sources.flatMap((source) => [...source.matchAll(idPattern)].map((match) => match[1])));

  const contractDocument = await readFile(path.join(root, "docs/testing.md"), "utf8");
  const registryIds = [...contractDocument.matchAll(/\| `([A-Z]+(?:-[A-Z]+)*-\d{3})` \|/g)].map((match) => match[1]);

  const documentationFiles = (await readdir(path.join(root, "docs")))
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join(root, "docs", file));
  const documentation = await Promise.all(documentationFiles.map((file) => readFile(file, "utf8")));
  const declaredIds = documentation.flatMap((source) => [...source.matchAll(declarationPattern)].map((match) => match[1]));

  assert.equal(new Set(registryIds).size, registryIds.length, "contract registry IDs must be unique");
  assert.equal(new Set(declaredIds).size, declaredIds.length, "feature document contract declarations must be unique");

  assert.deepEqual([...testIds].sort(), [...registryIds].sort(), "tests and contract registry differ");
  assert.deepEqual([...testIds].sort(), [...declaredIds].sort(), "tests and feature document declarations differ");
});
