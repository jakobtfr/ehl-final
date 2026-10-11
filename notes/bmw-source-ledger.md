# BMW source reconciliation — W1 first milestone

This is a redacted, local-input accounting at `bmw-source-reconciliation-v1` / `bmw-import-v1`,
checked on 2026-10-11 against the eight files in `data/BMW-Data`. The original files, extracted
text, feedback IDs and local SQLite database are excluded from Git. `notes/source-inventory.json`
provides the intake paths and hashes; this ledger compares them with parser output and persisted
`sources` / `evidence` rows. The manifest capture date is **not** a source acquisition date.

## Reproduce

Run this against a new database path inside ignored `database/local/`:

```bash
uv run python scripts/reconcile_bmw_sources.py \
  --data-dir /absolute/path/to/data \
  --db database/local/w1-reconciliation.db \
  --output database/local/w1-reconciliation.json
```

The command imports through the registered `market_data.import_bmw` capability twice, checks
the original SHA-256 against the manifest and each persisted source, compares parser records
and locations with stored evidence for every scope, inventories unused workbook sheets/PDF
pages, and fails if the second import creates evidence. JSON output contains counts and
locators, never source text or cell values. A non-fresh database still shows its first-pass
dedup status; use a fresh path for the baseline below.

## Reconciliation

On a fresh database: **8 files → 67 source scopes → 15,858 parsed records → 15,858 stored
evidence rows**. There were **0 identical record deduplications within a source** and **0 new
evidence rows on repeat import**; all 67 scopes deduplicated on the second pass. All eight
workbook sheets and all 78 option-list PDF pages yielded at least one located record. No
sheet or page was ignored, and no declared scope was unplaced. Counts below include deliberate
scope copies: an option-list page appears in each assigned reference market, and the combined
`G60_G68` sales sheet appears under both vehicles. These counts are not unique customers or
population prevalence.

| File (SHA-256) | Scope → persisted rows | Assignment and date status |
| --- | --- | --- |
| `F70_G60_G68_G70_customer_studies.xlsx`<br>`652386b8ccea0bec0e9f9b4648e6a971f1dc19d32e26c50111614153701bff17` | F70/EU 37; G60/EU 37; G60/US 824; G68/CN 37; G70/CN 37; G70/EU 37; G70/US 824. **1,833** total. | Source-declared vehicle/market. Reporting period only for all 1,833 cells; no observation dates. 2/2 sheets used. |
| `F70_OptionList.PDF`<br>`e7823aecbb4cc2b8b267ea65a0f128f464fc241719791082c30979dcb885635d` | F70/EU 23; F70/GB 23. **46** scoped pages. | Vehicle declared; markets inferred from customer-evidence reference markets. Date absent. 23/23 pages used. |
| `F70_feedback_hackathon.xlsx`<br>`651f09e3d899eb6fd294ee89aee23cc41417030425ec19420fbf615ad798163e` | F70/AU 30; DK 13; FI 11; FR 75; GB 2,790; JP 1,026; KR 5; SE 121; ZA 5. **4,076** rows. | Source-declared vehicle/market. Observation dates absent for all rows. 1/1 sheet used. |
| `G60_OptionList.PDF`<br>`97ee14fae6239473f125d72518b710d72e3a7c5481c2e6b635d3c1f289a2669d` | G60/EU 28; G60/GB 28; G60/US 28. **84** scoped pages. | Vehicle declared; markets inferred from customer-evidence reference markets. Date absent. 28/28 pages used. |
| `G60_feedback_hackathon.xlsx`<br>`ffaeb3ab943d299380542c228b3d944ed749bc80af54c75aa30a5e84b221d34f` | G60/AU 7; CA 41; DK 49; ES 1; FI 14; FR 14; GB 89; JP 76; KR 278; LV 3; NO 17; SE 51; US 4,365. **5,005** rows. | Source-declared vehicle/market. Observation dates absent for all rows. 1/1 sheet used. |
| `G70_OptionList.PDF`<br>`77be9d9cb39db058928e8f6a1a02ae1ec4e2055afde1235751466b5c97b524f0` | G70/CN 27; EU 27; GB 27; US 27. **108** scoped pages. | Vehicle declared; markets inferred from customer-evidence reference markets. Date absent. 27/27 pages used. |
| `G70_feedback_hackathon.xlsx`<br>`60d1c9932283bc244661ce9cd6c825099714d855bc4f3b9f1544d49a80821cf1` | G70/AU 2; CA 11; DK 5; ES 9; FI 2; FR 3; GB 22; JP 56; KR 157; NO 1; SE 2; US 4,418; ZA 2. **4,690** rows. | Source-declared vehicle/market. Observation dates absent for all rows. 1/1 sheet used. |
| `sales_volumes.xlsx`<br>`43db87dd0b52412a8912069a45c97b3b15900b5a00d3b79a5ec65ddcee1f49cf` | F70, G60, G68, G70 × CN, EU, ROW, US: one row per scope. **16** rows. | Source-declared vehicle/market; G60/G68 share a combined sheet. No observation dates; columns report 2024/2025 and project 2030. 3/3 sheets used. |

The three feedback workbooks have **13,771 classification rows**. A repeated feedback ID with
different classifications is retained as separate evidence; that is distinct from the zero
identical-record deduplications above. The study has 1,833 aggregate cells, option lists 238
scope-copied page records, and sales 16 aggregate rows. Feedback, studies, documents and sales
remain separate record types. The positive `Likes` classification feeds the separate
`preserve-v1` “what customers love” lane; it is not counted as a complaint.

## Source handling and gaps

| Class | Owner / acquisition / usage permission | Exact locator and dedup | Freshness and representativeness |
| --- | --- | --- | --- |
| Feedback workbooks | Formal BMW steward, acquisition date, retention and external-model permission **unknown**. Use only in the authorized local planning demonstration pending confirmation. | `sheet` + one-based `row` and source SHA-256; stored source dedup key is SHA-256 + vehicle + market. Feedback ID is a separate grouping key, not a source dedup key. | No row observation dates. Sample provenance is uneven; G60/US has 4,365 rows but 3,610 distinct feedback IDs, with 2,626 IDs (72.7%) from the largest provenance. Do not treat counts as prevalence. |
| Customer studies | Formal steward, acquisition date and reuse permission **unknown**; local planning demonstration boundary only pending confirmation. | `sheet` + one-based `cell`, `row` and `topic_row`; same source dedup key. | `US_2025` identifies a reporting year, not an observation timestamp. Aggregates lack respondent-level dates and cannot replace individual feedback. |
| Option-list PDFs | Formal steward, acquisition date and reuse permission **unknown**; local planning demonstration boundary only pending confirmation. | One-based PDF `page`; same source dedup key. | Undated documents. Market assignment is inferred from customer-evidence scopes, not stated by the PDFs; do not claim a market-specific option offering. |
| Sales workbook | Formal steward, acquisition date and reuse permission **unknown**; local planning demonstration boundary only pending confirmation. | `sheet` + one-based `row` and named volume column; same source dedup key. | 2024/2025 reported periods; 2030 is a projection. G60/G68 reported together. Sales share gives context, not customer sentiment or prevalence. |
| Annual report | Listed in manifest as `materials/BMW-Group-Report-2025-en.pdf`, but **not present locally and not imported**. Owner, acquisition and usage permission **unknown**. | No local page locator or persisted source hash can be verified. Manifest expected SHA-256: `970c0792d4d3600412564b4048cf38606b56151a5cef44598b09e115b85cf199`. | No report context claims from this input are validated. Acquire and verify a permitted copy before extraction. |

## Manually checked G60 / US locator set

In the fresh local database, five evidence records were selected across source classes. Each
persisted source hash matched the original bytes, and the persisted evidence was compared
with the original cell or independently extracted PDF page. All five matched; no content is
reproduced here. These locators can be reopened against the corresponding file hash above:

| Evidence lane | File | Locator | Check |
| --- | --- | --- | --- |
| Positive feedback (`Likes`) | `G60_feedback_hackathon.xlsx` | `Feedback_Explorer`, row 4590, `Customer Feedback` column | Exact cell text matched stored evidence. |
| Other feedback | `G60_feedback_hackathon.xlsx` | `Feedback_Explorer`, row 1444, `Customer Feedback` column | Exact cell text matched stored evidence. |
| Study aggregate | `F70_G60_G68_G70_customer_studies.xlsx` | `US_2025!C110` | Numeric cell matched stored aggregate value. |
| Option context | `G60_OptionList.PDF` | Page 11 | Page extraction matched stored document record. |
| Sales context | `sales_volumes.xlsx` | `G60_G68`, row 4, `market_code` and `volume_2024/2025/2030` columns | Market code and all three reported/projected cells matched; volume remains aggregate context. |

No public competitor or trend source was acquired in this milestone. Before selecting one for
import, record its URL, retrieval time, publication date if known, market/topic, selection
decision and usage permission. Approved connectors and BMW data egress boundaries remain
open. Source ownership, acquisition dates, permissions and the annual report are the remaining
W1 intake gaps; this ledger is a verified first slice, not a full W1 exit claim.
