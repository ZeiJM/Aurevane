# Phase 5 — Living World, Story & Supernatural Identity

**Status:** AUTHORIZED / IN PROGRESS — Owner authorized Phase 5 in parallel with Phase 4 on 2026-09-22. Initial Strategic Atlas implementation is complete; release evidence and live-testing handover are in `PHASE_5_HANDOVER.md`. Full Phase 5 and Owner Atlas acceptance remain open.

Phase 5 remains the player-facing world phase defined by the Owner. Staff authority, persistent-event infrastructure, Event Builder and live-event operations were reclassified into Phase 4 on 2026-09-19 and do not count as Phase 5 progress.

Historical branches, migrations and PR titles that contain `phase5` are retained only for repository/database traceability. They do not mean Phase 5 was authorized or started.

## 5A — Living World

**Goal:** turn AUREVANE from a battle/build platform into a living RPG world.

- [ ] Strategic Atlas / world map — initial implementation complete, including all eight authored road sectors, timed travel, private discovery, proximity PvP, panoramas and restrained environmental motion. Automated traversal, browser and real-Postgres contention coverage is recorded in the release evidence. Owner live visual/gameplay acceptance remains open; see `PHASE_5_HANDOVER.md`.
- [ ] Settlements and locations.
- [ ] NPCs and dialogue.
- [ ] Quests.
- [ ] Layered authoritative world state.
- [x] Player-facing world events / World Pulse built on the completed Phase 4 event-operations platform.
- [x] First spoiler-safe Field Observation → Archive vertical slice.
- [ ] Fragment Sets and deeper Archive/lore expansion.
- [ ] Vendors and location-based battle scenes.
- [ ] Relevant active-event/world-state delivery remains spoiler-safe and server-authoritative.
- [ ] Hidden, undiscovered or ineligible world/map data is absent from unauthorized payloads rather than merely hidden by presentation.

Current bounded progress:

- PR #672 merged the first persistent settlement interaction loop using the existing Verdant protected settlement, a generic watch-officer role and the Eastern Watch objective. It proves authoritative accept → inspect → return/complete persistence and idempotency without inventing a named NPC or reward. This is a vertical slice only; the broader settlements, NPCs/dialogue and quests checklist items remain open.
- PR #673 merged the first player-facing **World Pulse**, surfacing server-eligible live event objectives through the existing Phase 4 event-operations authority without creating a parallel event schema.
- PR #679 merged the stronger environmental-motion/globe-presentation pass, including a stable zoomed globe silhouette, responsive label-safe projection and a deliberate dark uncharted veil.
- PR #682 merged charted-sector globe selection. Existing unlabeled road sectors are now first-class globe destinations, hidden cells remain spoiler-safe, and `LIVING_ATLAS_EXPANSION.md` records the authored continuous-known-world expansion contract.
- PR #681 remains a draft merge-hold for distinct major-region settlement geometry until matching v02 regional paintings are produced and reviewed.
- PR #684 merged the first **Field Observation → Archive** slice. The Archive entry is derived server-side from legitimate observation completion, survives reload, and withholds the Weathered Observatory until it has actually been recorded. Fragment Sets and deeper lore matching remain separate work.
- PR #710 merged the versioned private supernatural story-state authority, permanent ordinary-path exclusivity, expected-version writes and durable idempotency. Its Production migration remains unapplied.
- PR #717 merged one authored Ascension proof identity and one authored Severence proof identity plus exact version-pinned choice transitions. These are identity/story proofs only; neither currently attaches supernatural combat power.
- PR #747 merged the spoiler-safe public projection for approved current/eligible supernatural identity facts without catalog leakage.
- PR #742 merged private immutable Cartographic Drift cycle-ledger persistence and PR #743 wired the server-only persisted-resolution service. The ledger migration remains unapplied to Production and no live cadence/scheduler has been authorized.

## 5B — Supernatural Fork

Current canonical normal-character progression follows `SUPERNATURAL_PATHS.md`:

```text
UNAWAKENED
→ ASCENDED
OR
→ SEVERED
```

**Severence** is the intentional AUREVANE spelling. The former Soulmark / Soulmarked / Mantle / Soul-Severed terminology is retired for new implementation. Mantle is not a separate current power family.

- [x] Data-driven, versioned supernatural story-state authority in repository code; Production migration remains pending release.
- [x] Small high-quality authored Ascension identity/story proof.
- [x] Permanent normal-character Ascended / Severed exclusivity authority.
- [ ] At least one representative authored Severence **combat power** proof; the merged Severence identity proof deliberately has no attached combat power.
- [x] Spoiler-safe identity delivery and authoritative eligibility/projection.
- [x] No unapproved supernatural mechanics added outside the canonical design documents.

Current bounded progress:

- PR #710 merged the first 5B authority foundation: typed versioned story state, Unawakened/Ascended/Severed invariants, private per-character persistence, expected-version writes, durable idempotency and server-only authored transitions.
- PR #717 merged the first version-pinned Ascension/Severence identity proofs and exact authored transitions; no combat power/effects are attached.
- PR #747 merged approved spoiler-safe identity facts for eligible choices/current bound identity.
- PR #763 merged the current-main Profile/fork presentation, deliberate choice UI and build-identity explanation while preserving the authoritative expected-version/idempotency boundary.
- **Release hold:** `20260924003000_phase5_supernatural_story_state.sql` is committed but not applied to live Supabase, so the permanent live choice path is not yet a Production-complete Phase-5 feature.

## 5C — Frontier Threshold

- [ ] Edge of the World / Unwritten Reach threshold.
- [x] Deliberate first frontier crossing foundation.
- [ ] Small outer-Reach vertical slice.
- [x] First Anchor discovery/persistence and player history presentation.
- [ ] Controlled **live** Cartographic Drift cycle; deterministic resolver/persistence/service are merged but Production ledger migration and cadence remain pending.
- [x] Field Observation → Archive integration.
- [ ] Early evidence of far inhabitants.
- [ ] Early Horizon/world gates where required by progression/story.

## Owner reference-review work — 2026-09-25

Detailed scope, acceptance and two-chat ownership: `ROADMAP_WORLD_EXPERIENCE.md`. These are refinements to 5A/5B, not a new phase or claims of completed work.

- [x] **P5-W1 — Faster ordinary travel:** inspect effective durations/overrides and the complete authoritative execution path; tune pace with before/after evidence while preserving route validation, ETA, stop/reconnect and encounter contention.
  - **Implementation candidate — 2026-09-25:** traced the full browser → API → server route/tick → private world-state RPC/locks → encounter authority path. Ordinary region/local cells and authored cross-sector links already use the 1,100 ms baseline; the eight legacy road sectors alone overrode internal cells to 4,000 ms. Candidate removes those eight overrides so ordinary road cells inherit 1,100 ms. The routefinder, ETA, due-time checks, one-step reconnect behavior, idempotency/version checks, encounter locking and training/battle/spectator guards are unchanged.
  - **Measured authoritative ETA:** Verdant local start → settlement remains 3 steps / 3.3 s. Verdant settlement → Aureth settlement remains the same 26-step authored path and changes from 63.4 s to 28.6 s. Crown Road regional edge → regional edge remains the same 14-step square-by-square path and changes from 50.2 s to 15.4 s. Saved 4,000 ms road routes fail current-route validation and stop before movement rather than silently changing timing.
  - **Verified and merged:** PR #740 passed exact-tree CI, Living Atlas browser and Browser Smoke and merged to `main` as `795e7223416a408736a304c860f6291d7d568284`. The final six-file tree preserved the measured timings above, stale-route fail-closed behavior, encounter/stop/reconnect protections, and the deployment lock.
  - **Owner follow-up — 2026-09-29:** live testing still felt too slow. PR #764 therefore quadrupled ordinary authoritative movement again: `STEP_MS` is now **275 ms**, active world sync uses the same 275 ms interval, and player-marker interpolation is **210 ms**. Representative 3/14/26-step ETAs are now **0.825 s / 3.85 s / 7.15 s**. Saved 1,100 ms and older 4,000 ms routes fail closed before movement. CI and authenticated Living Atlas passed before merge; combat movement/AP and Passive Training timers remain unchanged. This repository change is **not yet deployed to Production**.
- [x] **P5-W2 — Globe/local clarity:** PR #763 merged persistent player/destination context, explicit inspect/view versus travel, My Position recovery, accessible selection, route/ETA continuity and responsive label-safe globe/local presentation on top of the 275 ms travel pace. Production deployment remains pending.
- [ ] **P5-W3 — Place identity:** truthful contextual location/service/objective presentation is merged through #763, but distinct settlement geometry still waits on matching reviewed v02 art (#681) and broader authored place content remains open.
  - **P5-W3A — NPC conversation experience (Owner direction 2026-09-27):** build one reusable server-authoritative conversation framework. Keep the world visibly contextual behind focused dialogue; give approved NPC art strong but secondary presence; use readable dialogue and clear state-aware choice cards; stack responsively on mobile; preserve a clear End conversation action. Server projects authored nodes/legal choices from current location/quest/service/permission state; client submits only the selected authored action. Remote/stale/forged choices fail closed and irreversible/resource-spending choices require deliberate confirmation. The supplied reference is structural inspiration only—do not copy its art, branding, lore or exact styling. PR #765 is the active presentation slice using the already-authoritative Eastern Watch/Hinterland Patrol interactions; it introduces no new canon/reward/endpoint.
- [x] **P5-W4 — Character/fork clarity (repository implementation):** #710/#717/#747 provide authority and approved identity facts, while #763 merged current build identity plus unavailable/Unawakened/eligible/Ascended/Severed presentation and deliberate choice handling. The live supernatural persistence migration remains a separate Production release hold.

**Existing Phase 5 chat:** server travel timing, authored geography/content, NPC conversation nodes/eligibility/actions, quest/service authority and supernatural authority/projection. **Separate Work Mode chat:** layout/CSS/rendering, cinematic conversation overlay/portrait treatment, contextual location and identity UI, approved map art alignment and visual verification. Coordinate shared types/DTOs before edits; preserve active music, Anchor and Drift slices. No wholesale multi-sector renderer or new Skill browser here: those remain P6-W1/P6-S1. Missing approved media or mechanics are explicit open dependencies, not permission to invent content.

## Phase 5 gate

Players must understand the living-world loop, supernatural choice and frontier mystery without procedural-filler feeling.

The Owner explicitly authorized parallel Phase-5 work on 2026-09-22. Phase 4 was subsequently closed by explicit Owner decision on 2026-09-23; its closeout does not itself authorize an Atlas deployment. See `LIVING_ATLAS_DELIVERY.md` for implemented scope, verification and remaining content.
