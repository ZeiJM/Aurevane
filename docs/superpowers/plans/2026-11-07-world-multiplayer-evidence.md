# World multiplayer evidence implementation plan

**Goal:** Determine whether authoritative player movement reaches the eight-session cohort over private World Realtime after a reload burst, with no general World reads satisfying the peer-observation assertion.

**Architecture:** Keep game code and database policy unchanged. Teach the test-only frame observer both wire encodings used by the pinned Supabase client, then check joins, movement invalidation, and registered peer receipts as separate boundaries in the existing disposable Atlas workload.

**Authority:** Unified implementation handover sections 12.2–12.3 and 14I; WRL-13 and WRL-14. Preserve authoritative movement, discovered terrain and privacy. No hosting or deployment changes.

- [x] Reproduce the binary receive-frame gap with a JSON payload in a Realtime V2 binary envelope. Guard truncated, unrelated and outbound frames and keep raw frame details out of the artifacts. Run the focused diagnostics before and after the fix.
- [x] In `apps/web/e2e/world-multiplayer-load-case.ts`, track current-document joins by topic and matching reply, separately from the prior layout or connection. Preserve the concurrent dispersed/hotspot commands, crossing and battle checks. After a cohort reload, wait for the expected private scene, block ordinary World GETs in seven observers and require each to receive a changed broadcast and a subsequent registered peer-only response with new authoritative movement. Require bounded sector and actor scopes. Save sanitized evidence on failure as well as success.
- [x] Run the focused diagnostics, presence, World server and streaming tests, typecheck, lint, formatting and Playwright discovery.
- [ ] Run native acceptance in the Docker-backed Living Atlas workflow on the exact review head. Retain prior measurements as historical; do not mark either requirement fully verified or infer capacity from the local test harness.
