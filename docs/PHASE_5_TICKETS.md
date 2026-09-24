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
- [ ] Archive, Fragment Sets and lore.
- [ ] Vendors and location-based battle scenes.
- [ ] Relevant active-event/world-state delivery remains spoiler-safe and server-authoritative.
- [ ] Hidden, undiscovered or ineligible world/map data is absent from unauthorized payloads rather than merely hidden by presentation.

Current bounded progress:

- PR #672 merged the first persistent settlement interaction loop using the existing Verdant protected settlement, a generic watch-officer role and the Eastern Watch objective. It proves authoritative accept → inspect → return/complete persistence and idempotency without inventing a named NPC or reward. This is a vertical slice only; the broader settlements, NPCs/dialogue and quests checklist items remain open.
- PR #673 merged the first player-facing **World Pulse**, surfacing server-eligible live event objectives through the existing Phase 4 event-operations authority without creating a parallel event schema.
- PR #679 merged the stronger environmental-motion/globe-presentation pass, including a stable zoomed globe silhouette, responsive label-safe projection and a deliberate dark uncharted veil.
- PR #682 merged charted-sector globe selection. Existing unlabeled road sectors are now first-class globe destinations, hidden cells remain spoiler-safe, and `LIVING_ATLAS_EXPANSION.md` records the authored continuous-known-world expansion contract.
- PR #681 remains a draft merge-hold for distinct major-region settlement geometry until matching v02 regional paintings are produced and reviewed.
- PR #684 remains the active **Field Observation → Archive** slice; it is intentionally not counted as merged progress until exact-head verification/merge completes.

## 5B — Supernatural Fork

Current canonical normal-character progression follows `SUPERNATURAL_PATHS.md`:

```text
UNAWAKENED
→ ASCENDED
OR
→ SEVERED
```

**Severence** is the intentional AUREVANE spelling. The former Soulmark / Soulmarked / Mantle / Soul-Severed terminology is retired for new implementation. Mantle is not a separate current power family.

- [ ] Data-driven, versioned supernatural story state.
- [ ] Small high-quality Ascension proof.
- [ ] Permanent normal-character Ascended / Severed exclusivity.
- [ ] At least one representative authored Severence power proof.
- [ ] Spoiler-safe delivery and authoritative eligibility.
- [ ] No unapproved supernatural mechanics outside the canonical design documents.

Current bounded progress:

- Branch `agent/phase5-supernatural-story-state-20260923` implements the first 5B authority foundation: typed versioned story state, Unawakened/Ascended/Severed invariants, private per-character persistence, expected-version writes, durable idempotency and server-only authored transitions. It deliberately contains no Ascension catalog, Severence power package, quest/reward or player-facing choice UI yet.

## 5C — Frontier Threshold

- [ ] Edge of the World / Unwritten Reach threshold.
- [ ] Deliberate first frontier crossing.
- [ ] Small outer-Reach vertical slice.
- [ ] First Anchor.
- [ ] Controlled Cartographic Drift.
- [ ] Field Observation → Archive integration.
- [ ] Early evidence of far inhabitants.
- [ ] Early Horizon/world gates where required by progression/story.

## Phase 5 gate

Players must understand the living-world loop, supernatural choice and frontier mystery without procedural-filler feeling.

The Owner explicitly authorized parallel Phase-5 work on 2026-09-22. Phase 4 was subsequently closed by explicit Owner decision on 2026-09-23; its closeout does not itself authorize an Atlas deployment. See `LIVING_ATLAS_DELIVERY.md` for implemented scope, verification and remaining content.
