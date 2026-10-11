# W2 pipeline quality checkpoint: preserve versus complaint

Run on 2026-10-11 from `codex/bmw-pipeline`. This is a bounded regression audit, not the full W2 exit evaluation.

## Failure and guard

The provider validator previously accepted one explicitly positive `Likes` record as support for both a strength and a fabricated problem or need finding. The provider could then link both findings to a requirement and persist the false adverse interpretation. A synthetic G60/US driving-praise case reproduced this through `POST /pipeline/run`: before the guard, the API returned 201 and stored the false finding, requirement, and score.

`analysis_engine._validate` now rejects an explicitly positive customer record as support for a `problem` or `need` finding, even if the record also appears in a strength finding. The provider gets its existing single correction attempt; a second invalid response returns 422 before the analysis run, finding, requirement, or score is written. Prompt version `bmw-customer-requirements-v3` changes the analysis cache key, so earlier accepted v2 results are not reused for new runs. The existing preservation requirement, scope checks, source-target grounding, deterministic scoring, and human decision gate remain in place. This guard treats the imported positive classification as authoritative; a genuinely mixed record classified `Likes` needs source review or a more precise span-level representation.

## Reproducible evidence

| Check | Result | Scope and limit |
| --- | --- | --- |
| Synthetic false problem and false need | Both rejected after one correction attempt; zero analysis runs, findings, or requirements persisted | Two authored provider responses, one positive record each; mocked provider, not model accuracy |
| Focused tests | 193 passed | Analysis, target grounding, update stability, core workflow, scoring, and evaluation tests |
| Synthetic change alerts | 3 true positives, 0 false positives, 0 false negatives over 8 authored scenarios; trace coverage 3/3 requirements | Two approved synthetic themes; no inference to live false-alert rates or active PM effort |
| Isolated Compose HTTP/MCP journey | 12/12 checks passed with local inputs mounted read-only | Deterministic provider; source import, extraction, requirements, score recomputation, human decisions, changed-evidence review, MCP trace, and audit |
| Mounted G60/US import and trace | 5,218 records, including 4,229 customer evidence records; 11 requirements; verifier checked complete finding/customer trace coverage | Counts and links only. No independent PM assessment of the hero's wording, targets, representativeness, or source-span meaning. No G60/US approvals existed in this disposable run. |

Commands: `uv run pytest -q tests/test_analysis_engine.py tests/test_grounding_api.py tests/test_ai_update_stability.py tests/test_workflow.py tests/test_prioritization.py tests/test_evaluation.py`; `uv run python scripts/evaluate_pipeline.py`; `docker compose -p ehl-w2-pipeline up --build -d api mcp` with unique ports and the original `data/` mounted read-only; `uv run python scripts/verify_backend.py --api-url http://127.0.0.1:18116 --mcp-url http://127.0.0.1:18117/mcp --real-data`. The isolated stack was stopped with `docker compose -p ehl-w2-pipeline down`; its generated database stays ignored under `database/local/`.

The first verifier attempt immediately after a fresh Compose start disconnected before MCP startup completed. The API and MCP logs then showed normal startup; the ready-state rerun passed 12/12 checks.

Grounding quality, duplicate detection beyond the one authored replay, and review effort remain unmeasured on independently labelled BMW evidence. The target guard's two negative cases establish a persistence boundary, not model precision or recall.
