import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const idPattern = /\[([A-Z]+(?:-[A-Z]+)*-\d{3})\]/g;
const declarationPattern = /<!-- contract: ([A-Z]+(?:-[A-Z]+)*-\d{3}) -->/g;

async function testFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return testFiles(target);
      return /\.(?:test|spec)\.ts$/.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

async function documentationFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return documentationFiles(target);
      return entry.name.endsWith(".md") ? [target] : [];
    }),
  );
  return nested.flat();
}

test("[TEST-DOC-001] keeps regression test IDs synchronized with the contract document", async () => {
  const files = [
    ...(await testFiles(path.join(root, "packages"))),
    ...(await testFiles(path.join(root, "apps/dashboard/tests"))),
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const testIds = new Set(sources.flatMap((source) => [...source.matchAll(idPattern)].map((match) => match[1])));

  const contractDocument = await readFile(path.join(root, "docs/testing.md"), "utf8");
  const registryIds = [...contractDocument.matchAll(/\| `([A-Z]+(?:-[A-Z]+)*-\d{3})` \|/g)].map((match) => match[1]);

  const featureDocuments = await documentationFiles(path.join(root, "docs"));
  const documentation = await Promise.all(featureDocuments.map((file) => readFile(file, "utf8")));
  const declaredIds = documentation.flatMap((source) =>
    [...source.matchAll(declarationPattern)].map((match) => match[1]),
  );

  assert.equal(new Set(registryIds).size, registryIds.length, "contract registry IDs must be unique");
  assert.equal(new Set(declaredIds).size, declaredIds.length, "feature document contract declarations must be unique");

  assert.deepEqual([...testIds].sort(), [...registryIds].sort(), "tests and contract registry differ");
  assert.deepEqual([...testIds].sort(), [...declaredIds].sort(), "tests and feature document declarations differ");
});
