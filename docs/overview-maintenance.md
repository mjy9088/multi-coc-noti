# Overview File Maintenance

## Purpose

`overview.md` files are local ownership maps. They help a contributor choose the correct folder before reading individual
files or adding new code. They complement feature documents: overview files describe where code belongs, while normative
behavior remains in the feature documents linked from the README.

## Required structure

Every overview uses this minimum shape:

```markdown
# Overview

`path/from/repository/root`

## Purpose

What this directory owns and, when useful, what it deliberately does not own.
```

Use `.` as the path marker in the repository-root `overview.md`. When a `## Subfolders` section is present, every entry
must name one direct child directory and include a short description:

```markdown
- `child/` — responsibility and boundary.
```

Add `Key files`, `Areas`, `Boundary`, `Dependency direction`, or `Verification` only when they improve navigation. Avoid a
complete file inventory that becomes stale without explaining ownership.

## Which folders need an overview

`pnpm check:overviews` derives requirements from Git-tracked and untracked files under `apps/` and `packages/`; there is no
hand-maintained required-file list. It currently requires overviews for:

- every application and workspace-package root;
- each application `app/` implementation root;
- directories that group multiple child responsibilities;
- directories with at least two direct implementation files.

Tests, static assets, translations, ambient types, migration artifacts, and thin Next.js route segments are treated as
trivial when their parent overview explains them. An overview file itself does not make a directory non-trivial.

When the heuristic misclassifies a directory, prefer improving the ownership or the general rule. Add a narrowly explained
exception only when the directory is intentionally unusual; do not add a fixed list of required overview paths.

## Writing rules

- Describe the current code, not an aspirational structure. Put future migrations in a plan document.
- Name the owner of behavior and the boundary with adjacent folders.
- Keep parent overviews broad and child overviews specific; do not copy the same file list down the hierarchy.
- Update the nearest overview when moving a responsibility, adding a meaningful subfolder, or changing dependency direction.
- Link to normative feature or testing documentation rather than restating detailed behavior contracts.
- Do not document generated output, ignored local state, `node_modules`, or build artifacts.

## Validation

Run:

```bash
pnpm check:overviews
```

The check validates required coverage, the exact heading and path marker, the `Purpose` section, declared direct
subfolders, and local Markdown links. It is also part of root `pnpm test`.

