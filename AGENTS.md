# Repository working agreement

## Start here

Before changing user-visible behavior, API/storage semantics, or regression tests, read [`docs/testing.md`](docs/testing.md). Feature details live in the documents linked from the README; update those documents together with behavior changes.

## Test contracts

Every automated regression contract has one stable ID such as `ALERT-PLAN-001`. The same ID must exist in all three places:

1. Beside the normative requirement in a feature document under `docs/`:

   ```markdown
   <!-- contract: ALERT-PLAN-001 -->
   ```

2. As one row in the contract registry in `docs/testing.md`.
3. In the test title:

   ```ts
   test("[ALERT-PLAN-001] describes the protected behavior", () => {});
   ```

`TEST-DOC-001` checks these sets in both directions and rejects duplicate feature-document declarations. Run the focused check with:

```bash
pnpm --filter @multi-coc/collector test
```

When this check fails, search the reported ID in `docs/testing.md` and fix the missing or stale location. Do not change an assertion merely to make CI pass: decide from the linked requirement whether the implementation is wrong, the requirement intentionally changed, or the contract is no longer needed.

When adding or changing behavior:

- Update the normative feature document first or in the same change.
- Add or reuse a contract ID when an automated test protects the behavior.
- If meaningful automation is not yet feasible, add the behavior to `현재 자동화되지 않은 주요 계약` in `docs/testing.md`; do not add a `contract` declaration without a test.
- Keep multiple tests under one ID only when they protect the same user or operational contract.
- Remove an ID from the feature document, registry, and tests together only after its documented reason no longer applies.

Run the complete verification before handing off changes:

```bash
pnpm test
```
