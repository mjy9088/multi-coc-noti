import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const trivialDirectoryNames = new Set(["drizzle", "i18n", "messages", "public", "test", "tests", "types"]);

function repoPath(value) {
  return value.split(path.sep).join("/");
}

function listOverviewFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "overview.md", "**/overview.md"],
    { cwd: root, encoding: "utf8" },
  );
  return [...new Set(output.split("\n").filter(Boolean))].sort();
}

function listWorkspaceFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "apps", "packages"],
    { cwd: root, encoding: "utf8" },
  );
  return [...new Set(output.split("\n").filter(Boolean))].sort();
}

function requiredOverviewDirectories(workspaceFiles) {
  const directories = new Map();
  for (const file of workspaceFiles) {
    if (file.endsWith("/overview.md")) continue;
    const segments = file.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      const directory = segments.slice(0, length).join("/");
      if (!directories.has(directory)) directories.set(directory, { files: new Set(), children: new Set() });
      const relative = segments.slice(length);
      if (relative.length === 1) directories.get(directory).files.add(relative[0]);
      else directories.get(directory).children.add(relative[0]);
    }
  }

  return [...directories.entries()]
    .filter(([directory, contents]) => {
      const segments = directory.split("/");
      if (directory === "apps" || directory === "packages") return true;
      if (segments.length === 2) return true;
      if (segments.length === 3 && segments[0] === "apps" && segments.at(-1) === "app") return true;
      if (directory.startsWith("apps/dashboard/app/")) return false;
      if (segments.some((segment) => trivialDirectoryNames.has(segment))) return false;
      return contents.files.size >= 2 || contents.children.size >= 2;
    })
    .map(([directory]) => directory)
    .sort();
}

function parseSections(markdown) {
  const sections = new Map();
  let current = null;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      current = line.slice(3).trim();
      sections.set(current, []);
    } else if (current) {
      sections.get(current).push(line);
    }
  }
  return sections;
}

function validateOverview(file) {
  const issues = [];
  const absolute = path.join(root, file);
  const markdown = readFileSync(absolute, "utf8");
  const lines = markdown.split("\n");
  const directory = repoPath(path.posix.dirname(file)) === "." ? "." : repoPath(path.posix.dirname(file));
  const pathLine = lines
    .find((line) => /^`[^`]+`$/.test(line.trim()))
    ?.trim()
    .slice(1, -1);
  const sections = parseSections(markdown);

  if (lines[0] !== "# Overview") issues.push("first line must be exactly '# Overview'");
  if (pathLine !== directory) issues.push(`path line must be exactly \`${directory}\``);
  if (!sections.has("Purpose")) issues.push("missing required '## Purpose' section");

  for (const line of sections.get("Subfolders") ?? []) {
    const match = /^- `([^`]+\/)`\s+[—-]\s+\S/.exec(line.trim());
    if (!line.trim().startsWith("- ")) continue;
    if (!match) {
      issues.push(`Subfolders entry must use '- \`name/\` — description': ${line.trim()}`);
      continue;
    }
    const entry = match[1];
    if (entry.includes("/") && entry.slice(0, -1).includes("/")) {
      issues.push(`Subfolders entry must name a direct child directory: ${entry}`);
      continue;
    }
    const target = path.join(path.dirname(absolute), entry);
    if (!existsSync(target) || !statSync(target).isDirectory()) {
      issues.push(`declared subfolder does not exist: ${entry}`);
    }
  }

  const keyFilesSection = [...sections.entries()].find(([name]) => name.toLowerCase() === "key files")?.[1] ?? [];
  for (const line of keyFilesSection) {
    if (!line.trim().startsWith("- ")) continue;
    const match = /^- `([^`]+)`\s+[—-]\s+\S/.exec(line.trim());
    if (!match) {
      issues.push(`Key files entry must use '- \`name\` — description': ${line.trim()}`);
      continue;
    }
    const entry = match[1];
    if (entry.includes("*") || entry.endsWith("/")) {
      issues.push(`Key files entry must name one concrete file: ${entry}`);
      continue;
    }
    const target = path.join(path.dirname(absolute), entry);
    if (!existsSync(target) || !statSync(target).isFile()) issues.push(`declared key file does not exist: ${entry}`);
  }

  const linkPattern = /\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const link = match[1].split("#", 1)[0];
    if (/^[a-z]+:/i.test(link)) continue;
    const target = path.resolve(path.dirname(absolute), decodeURIComponent(link));
    if (!existsSync(target)) issues.push(`local Markdown link does not exist: ${match[1]}`);
  }

  return issues.map((message) => ({ file, message }));
}

const files = listOverviewFiles();
const requiredDirectories = requiredOverviewDirectories(listWorkspaceFiles());
const missing = requiredDirectories
  .map((directory) => `${directory}/overview.md`)
  .filter((file) => !files.includes(file));
const issues = [
  ...missing.map((file) => ({ file, message: "required overview is missing" })),
  ...files.flatMap(validateOverview),
];

if (issues.length) {
  console.error("[check-overviews] Overview validation failed:");
  for (const issue of issues) console.error(`- ${issue.file}: ${issue.message}`);
  process.exit(1);
}

console.log(`[check-overviews] ${files.length} overview files are structurally valid.`);
