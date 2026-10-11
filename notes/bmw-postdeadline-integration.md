# BMW postdeadline integration checkpoint

**11 October 2026, after 11:30 Madrid.** This local branch integrates the first independently
reviewable W1–W3 slices from the R0 platform base. It is not the frozen presentation build,
and it has not been pushed or merged to `main`.

| Component | Branch commit | Integration commit | Verified slice |
| --- | --- | --- | --- |
| W1 source reconciliation | `codex/bmw-data` `1456bd3` | `2a8ef28` | Redacted per-file and per-scope ledger, repeat-import deduplication, five manually checked G60/US locators. |
| W2 pipeline quality | `codex/bmw-pipeline` `76cc2e6` | `cec1d13` | Positive `Likes` evidence cannot support an adverse finding; analysis prompt/cache version advanced to v3. |
| W3 runtime scope | `codex/bmw-agents` `150fa7c` | `a9e1f61` | ID-only task references checked at creation, edit and execution, including retries and persisted drift. |

Base: `origin/main` `9dfc238`. Database schema remains at migration `0015`; these slices
change no shared API/MCP contract, database migration or web source. The frozen G60/US
presentation branch and its snapshot were not changed.

## Combined verification

- `uv run ruff check .`: passed.
- `uv run pytest -q`: **887 passed**.
- In `web/`, after `bun install --frozen-lockfile`: `bun run test` **57 passed**;
  `bun run lint`, `bun run typecheck` and `bun run build` passed. The first web attempt lacked
  this worktree's `node_modules`; installation resolved that setup failure without code changes.
- Isolated Compose project `bmw-integration`, with API `18220`, MCP `18221`, web `13220`,
  a distinct ignored SQLite database and a read-only mount of the original local inputs:
  `docker compose --profile web -p bmw-integration up --build --wait -d api mcp web`.
  All three services started healthy. `scripts/verify_backend.py --platform --real-data`
  passed the deterministic HTTP/MCP journey, including source import, G60/US trace,
  scoring, human-only decision gates, changed-evidence review, market/request workflow,
  task runs and audit verification. Its deliberately stale decision produced the expected
  MCP HTTP 409 in logs; no unexpected service errors were found.
- In the browser, `/g60/us` rendered 5,218 evidence records and 11 requirements. The
  requirement detail and evidence trace opened with source file and row locators;
  browser errors/warnings were empty. This was a read-only UI check, not a PM decision.
- The isolated stack was stopped with `docker compose -p bmw-integration down`.
  Its database stays ignored under `database/local/`.

## Open work and decision gates

The [W1 source ledger](bmw-source-ledger.md) accounts for eight available BMW inputs,
67 scopes and 15,858 evidence rows. The annual report is absent locally; formal source
stewards, acquisition dates, permitted uses and retention remain unconfirmed. W2 still
needs independent PM review of the hero wording and a broader labelled quality sample.
W3 still needs a genuine orchestrator/worker loop and governed budgets/timeouts. W4
identity and enterprise controls, W5 PM experience/evaluation, and human presentation
rehearsal/recording/venue checks remain open. No automated or client-supplied `PM` actor
call is evidence of a real human approval. Original BMW files, verbatims, local databases
and snapshots remain outside Git.
