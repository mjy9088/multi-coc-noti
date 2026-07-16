import { readFile } from "node:fs/promises";
import path from "node:path";

const [filename = "examples/snapshot.json"] = process.argv.slice(2);
const apiKey = process.env.ADMIN_TOKEN;
if (!apiKey) throw new Error("ADMIN_TOKEN is missing from the selected environment file");

const apiBase = (process.env.COLLECTOR_API_BASE || "http://127.0.0.1:8787").replace(/\/$/, "");
const contentType = path.extname(filename).toLowerCase() === ".jsonl" ? "application/x-ndjson" : "application/json";
const dataOrigin = filename.split(path.sep).includes("examples") ? "example" : "push";
const response = await fetch(`${apiBase}/api/ingest`, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": contentType, "X-Data-Origin": dataOrigin },
  body: await readFile(filename, "utf8"),
});
const result = await response.json();
if (!response.ok) throw new Error(`collector HTTP ${response.status}: ${result.error || "unknown error"}`);
console.log(`accepted=${result.accepted} account=${result.latest?.id || "unknown"} village=${result.latest?.name || "unknown"}`);
