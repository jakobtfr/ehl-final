# Final pitch run of show: V1 trailer, pipeline, demo, V2 trailer, 3:00 hard stop

Status: **stage script**, 11 October 2026. This replaces the timing in the
[pitch story](pitch-story-and-video.md) and the [pitch plan](pitch-plan.md). The
[runbook](bmw-demo-runbook.md) still governs reset and preflight, and the
[claim ledger](bmw-demo-claim-ledger.md) governs every number. The deck is
[`pitch/output/pitch-final.html`](../pitch/output/pitch-final.html), with a static backup in
[`pitch/output/pdf/pitch-final.pdf`](../pitch/output/pdf/pitch-final.pdf).

## Why this shape

The judges are BMW product managers. They score five criteria and reward honesty
([challenge](challenge.md)). Their stated pains are a two-year requirements process,
turning predecessor feedback into the next car's requirements, and balancing markets
([guidance](bmw-guidance.md)). Every PM has to defend a requirement on three questions,
so the pitch is built around them. The slides only frame those questions and close
them. The product answers them live.

| Question on the hook slide | Live answer | Criterion it earns |
| --- | --- | --- |
| Where did it come from? | Evidence Trace → workbook, sheet, row 432 | Traceability and auditability |
| How sure are we? | Priority 71.26 beside grade C; 80% labelled `PM assumption` | Decision and scoring logic |
| (decision) | The presenter approves the exact version; AI approval is refused | Workflow and human decision-making |
| What changed since we decided? | 1 of 11 reopened, +0.07, approved v2 frozen | Innovation, scale and impact |
| (whole demo) | Real G60 / US data in a working UI, limits stated | Solution quality and feasibility |

## Timing

Two 15-second trailers bracket the demo: V1 introduces the product management pipeline, V2 the
multi-agent system. These are rehearsal targets; no presenter has timed them yet.

| Clock | Screen | Driver | Presenter says |
| --- | --- | --- | --- |
| 0:00–0:15 | **V1 trailer** (deck slide `V1`) | Press → once to play. The deck moves to Pipeline 1 when it ends. | Nothing. |
| 0:15–0:30 | **Pipeline 1** | Press → when the presenter finishes. | The pipeline: collect feedback and public sources, link every row word for word, propose requirements, score priority beside evidence grade, and the PM decides; new evidence reopens only affected proposals. |
| 0:30–0:40 | **Pipeline 2** (three questions) | Switch to the app tab at the end. | “Every requirement has to survive three questions. Where did it come from? How sure are we? What changed since we decided? Here's the G60 i5 in the US, live.” |
| 0:40–2:15 | **App demo**: overview → `REQ-G60-US-001` → Evidence Trace → row 432 → Score → decision → simulated update → Versions | As in the beats below. | Trace, score and grade, the presenter's own decision, then the one reopened proposal (+0.07). |
| 2:15–2:30 | **V2 trailer** | Switch to the deck tab, press → once: it opens V2 and plays it. The deck moves to Agents when it ends. | Nothing. |
| 2:30–2:40 | **Agents** | Press → when done. | “An orchestrator plans one step at a time and delegates to scoped specialist agents. Every step is a recorded task, and no agent can approve.” |
| 2:40–2:50 | **Close** | — | “Agents prepare. Product managers decide.” |

Demo beats and their lines, compressed from the earlier script: overview (4,365 rows, about 73% of
feedback IDs from one source, so samples, not market share); charging proposal → Evidence Trace → row 432
(264 linked rows, 12 checked by hand); Score (71.26 from a versioned rubric, grade C beside it, 80% target
labelled PM assumption); the **presenter** approves the exact version, then the driver runs
`scripts/run_bmw_demo_update.sh`; Needs review → Open review → **Versions** (simulated record, 1 of 11
reopened, 71.26 → 71.33, approved version frozen).

## Cut rules

1. **Running more than 10 seconds late at 1:35:** shorten the overview to “4,365 rows, 73% from one source, so samples, not market share.”
2. **The update script takes more than 10 seconds:** keep talking through the decision line. Time it in rehearsal and type the command in the terminal beforehand.
3. **The presenter does not approve after reviewing:** stop before the update. Switch to the deck, press `B` and go to **B5**: “In our rehearsal, new input reopened only this proposal.” Say that it was a rehearsal.
4. **Never** let anyone but the presenter make the decision, and never describe the saved post-update snapshot's automated `PM` test as a human approval.

## Fallback if the app stalls for more than 3 seconds

Switch to the deck tab and press `B`. Backup slides **B1–B5** follow the demo beats in
order: overview, trace, score, decision, update. Keep talking from the same script without
apologising. The local capture pack ([`bmw-demo-captures.md`](bmw-demo-captures.md)) is the
second fallback. No recorded live run exists yet.

## Q&A

Answer in under 30 seconds: the number first, the caveat second. Use the
[Q&A card](bmw-demo-qa.md). Two backup slides support common questions:

- **B6 Built today, pilot next:** for “what didn't you build?”, Codebeamer, SSO or scale.
- **B7 The agent-ready runtime:** for “where are the agents?”. It belongs to the integrated platform build, not the frozen demo, and LLM orchestration is the next phase.

## Stage setup

- One Chrome window, presentation mode (`⌘⌃F`). Tab 1 is the deck, tab 2 is
  <http://127.0.0.1:13203/g60/us> after `scripts/reset_bmw_demo.sh predecision`.
  Switch with `⌘⌥→` and `⌘⌥←`. The deck's own `F` fullscreen ends when you switch tabs, so do not use it.
- Put `pitch-film-v1-short.mp4` and `pitch-film-v2-short.mp4` in `pitch/output/`, next to the deck.
  Without them, each trailer slot shows a title card. Play both once before the session so they are
  buffered, then reload the deck (it reopens on the slide in the URL hash, e.g. `#1`).
- App browser zoom set so table text reads at the back of the room; check it on the venue display.
- Notifications off, terminal open in the `bmw-demo-core` worktree with the update command typed.

## Deck keys

`→`/Space next (on a trailer slide, the first press plays it; moving onto V2 plays it at once) · `←` back ·
`B` first backup slide · `C` close slide · `T` rehearsal stopwatch · `E` edit text ·
`R` replay slide animation. The toolbar appears on hover only.
