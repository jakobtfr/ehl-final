# 30-second opening film

A Remotion edit modelled on the Legora homepage trailer: fast live-action cuts (BMW cars and plants) alternating with macro, shallow-focus shots of our own product. It plays before the pitch from the deck's **Film** slide, which looks for `pitch/output/pitch-film.mp4`.

| Time | Part | What is on screen |
| --- | --- | --- |
| 0–5 s | Cold open | Engine start, then BMW driving and plant shots, cut faster and faster. |
| 5–15 s | **V1** · the product management pipeline | Imports (4,365 rows) → original feedback row 432 → `REQ-G60-US-001` → priority 71.26 beside grade C → evidence trace → the PM approves v2 → new evidence reopens 1 of 11 (+0.07) → real app screens. |
| 15–27 s | **V2** · the multi-agent system | Orchestrator → 11 specialist agents with autonomy levels → task queue → integrations (Claude, ChatGPT, Teams, Excel, Outlook, SharePoint, Jira, Power BI) → recorded runs → human gate (AI approval refused) → real multi-agent page → climax cuts. |
| 27–30 s | Close | “Agents prepare. Product managers decide.” · BMW Product Intelligence. |

There is no voiceover. Music, engine sounds and impacts come from ElevenLabs; every line is on screen, so the film also works muted.

## Render

```bash
cd pitch/film
npm install
npm run render          # renders out/pitch-film.mp4, then writes ../output/pitch-film.mp4
npm run studio          # interactive preview
```

## Edit

- **Timeline:** [`src/Film.tsx`](src/Film.tsx). `CUTS` and `SFX` are expressed in beats (`b(k)`) of the 143.5 BPM music, offset so the drop lands on frame 450 (15.0 s). See [`src/theme.ts`](src/theme.ts).
- **Product shots:** [`src/ui/v1.tsx`](src/ui/v1.tsx) and [`src/ui/v2.tsx`](src/ui/v2.tsx) rebuild app components in the app's tokens (Barlow, IBM Plex Mono, `#1c69d4`, square cards). Numbers come from the frozen G60 / US claim ledger; the agent registry, tasks and runs mirror `GET /agents`, `/tasks` and `/runs` on the integrated platform build.
- **Live action:** [`src/footage.ts`](src/footage.ts) maps slots to 2-second HD shots in `public/footage/shots/` (`coldopen-*`, `interstitial-*`, `factory-*`) with a start offset. All are cut from BMW PressClub masters except `factory-07` (Pexels).
- **Audio:** prompts live in [`src/audio-spec.mjs`](src/audio-spec.mjs). `npm run audio` regenerates changed items (needs `ELEVENLABS_API_KEY` in `.env`, see `.env.example`); `scripts/edit-music.sh` cuts the music bed to the edit (muffled cold open, silence before the drop and before the close).

## Local-only inputs (not in Git)

- `public/footage/` — official BMW PressClub clips (`bmw/PF*.mp4`, plus HD cut-downs in `shots/`) and Pexels stock (`pexels/`). PressClub material is BMW's own press footage; Pexels clips are under the Pexels licence.
- `public/captures/` and `captures/` — screenshots of the running app; they contain BMW-derived data. Recapture with `node scripts/capture.mjs <base-url> captures/<name> /g60/us /g60/us/agents …`.

Third-party logos in `public/logos/` (Microsoft, OpenAI, Anthropic, Atlassian) belong to their owners. The integrations shot shows where the platform's MCP/API surface plugs in; only MCP clients (Claude, ChatGPT) and Excel/PDF imports exist today, so present the others as the integration path, not as shipped connectors.
