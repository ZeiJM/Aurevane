# Phase 5 — Living World, Story, Supernatural Identity & Frontier Threshold

**Status:** Active execution ledger subordinate to `docs/GAME_MASTER_PLAN.md`, `docs/ROADMAP.md`, `docs/WORLD.md`, `docs/REKINDLING_FRONTIER.md`, `docs/SUPERNATURAL_SYSTEM_REFINEMENT.md`, and `docs/ROADMAP_LIVE_EVENTS_HOMESTEAD_NAVIGATION.md`.

**Started:** 2026-09-18.

Phase 4 combat engineering is preserved as the incoming platform. Its remaining Owner/human acceptance and Production release decision are separate gates; Phase 5 implementation does not silently activate the Phase 4 rebalance or deploy Production.

## Execution order

### P5.1 — Staff authority foundation

- [x] Introduce exactly four canonical authority classes: Game Owner, Moderator, Content Staff, Event Staff.
- [x] Support multiple delegated roles per account without inventing additional role classes.
- [x] Preserve the protected Game Owner identity; normal staff grant/revoke cannot create or remove it.
- [x] Keep authorization server-side and service-role-only; no browser role value grants authority.
- [x] Add monotonic access versions so delegated role changes are immediately observable by server authorization reads.
- [x] Add durable server-only role migration/grant/revoke audit history.
- [x] Verify single-Owner, multi-role, revocation/versioning, audit, and browser-denial invariants against the rebuilt database.
- [x] Migrate the legacy `owner | content-staff` operator model without breaking Combat Content authoring.
- [x] Make `/master` available to all four staff classes while keeping Combat Content limited to Game Owner/Content Staff.
- [x] Add protected Owner grant/revoke RPC and route foundations for delegated roles.
- [x] Add Owner-facing staff-management UI, WORLDWRIGHT Owner presentation, and explicit special-capability grants without creating new role names.

P5.1 closeout: staff authority changes require an explicit reason and confirmation at the authenticated server boundary; exact-email account lookup and staff listing are Owner-only; root access/staff-management capabilities are not delegable special grants; special capabilities only augment an existing delegated staff role; the final delegated role cannot be removed while special grants remain; role/capability mutations share monotonic access versioning and durable audit history.

### P5.2 — Persistent event kernel

- [x] Versioned Event Template / Event Definition.
- [x] Event Run / Phase / Objective state.
- [x] Explicit global / region / node / cohort scope.
- [x] Authoritative lifecycle clock and restart recovery.
- [x] Typed Event Effect references only; no arbitrary scripts or SQL.
- [x] Participant ledger, idempotent contribution and claim boundaries.
- [ ] Reward Package references through normal reward services.
- [ ] Cleanup / end / archive invariants.

P5.2 participation boundary: Event participation is isolated per immutable Event Run and character/account. Contributions are service-only, tied to an active run objective, deduplicated by authoritative source identity, provenance-bearing, and idempotent under duplicate delivery. Reward claims currently stop at an idempotent reservation against Reward Package references pinned by that run's immutable Event Definition; this slice does not execute or mint rewards. Browser roles cannot read or write the private ledger or invoke contribution/claim authority directly.

### P5.3 — Event Builder MVP

- [ ] Event Staff draft, validate, preview and publish workflow.
- [ ] Phase/objective composition.
- [ ] Approved map markers, encounters, quests/dialogue packages, NPC presentation, vendors, announcements and media references.
- [ ] Schedule/unschedule and conflict/dependency checks.
- [ ] Test clock / phase jump in preview only.
- [ ] Owner-gated permanent canon/world changes.

### P5.4 — Live event operations

- [ ] Live dashboard for phase/time, participants, progress, objectives, claims and active effects.
- [ ] Advance / pause / resume / stop / emergency-stop controls with permission checks.
- [ ] Restart and duplicate-transition recovery.
- [ ] Chronicle/participant-history persistence and safe cleanup.

### P5.5 — Player World Activity surface

- [ ] Relevant active events and World Pulse presentation.
- [ ] Server-authoritative eligibility and participation state.
- [ ] Realtime messages act only as invalidation/refetch signals.
- [ ] No spoiler-bearing hidden content is sent to unauthorized clients.

### P5.6 — Strategic map layers

- [ ] Tracked Objectives.
- [ ] Quests.
- [ ] Events.
- [ ] Settlements & Services.
- [ ] Travel Routes.
- [ ] Expeditions / Combat Locations.
- [ ] Lore / Discoveries where eligible.
- [ ] Per-player layer preferences, sensible defaults, Clean Map and zoom-aware clustering.
- [ ] Hidden/undiscovered/ineligible markers remain absent from unauthorized payloads.

### P5.7 — Quest guidance

- [ ] Region-local stable N/S + E/W coordinates.
- [ ] TRACKED / BASIC exact guidance.
- [ ] SEARCH AREA / APPROXIMATE guidance.
- [ ] HIDDEN / CLUE-LED guidance with explicit journal messaging.
- [ ] Shared coordinates never bypass server access requirements.

### P5.8 — Story, supernatural fork and frontier proof

- [ ] Data-driven versioned story state and spoiler-safe delivery.
- [ ] Small high-quality Soulmark proof.
- [ ] At least one valid Mantle route.
- [ ] Normal-character SOULMARKED / SOUL_SEVERED exclusivity.
- [ ] Early Horizon/world gates.
- [ ] First deliberate frontier crossing, outer-Reach vertical slice, Anchor and controlled Cartographic Drift proof.
- [ ] Field Observation → Archive integration.

## Phase 5 gate

Phase 5 is not accepted until Event Staff can run a real persistent multi-phase event without routine code deployment; the event survives restart and cleans up safely; map complexity remains controllable; exact/approximate/hidden navigation does not leak secret content; and the living-world, supernatural-fork and frontier loops are understandable in real play.
