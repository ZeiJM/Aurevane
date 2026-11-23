# Battle Workspaces and Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox tracking.

**Goal:** Improve mobile battle space, turn awareness, map zoom and activity accuracy without regressing the approved interface.

**Architecture:** Reuse the shared BattleExperience cockpit and Chronicle renderer. A per-battle mobile workspace coordinates the real chat bridge and lower-panel readers; independent World/activity fixes follow demonstrated causes.

**Tech Stack:** Existing React/TypeScript/CSS, Vitest and production-component Playwright fixtures; existing Supabase presence RPCs.

**Spec:** `docs/superpowers/specs/2026-10-24-battle-workspaces-activity-design.md`

## Global Constraints

- One mobile footer row at the existing single-row height; preserve timeline and battlefield.
- No gameplay, authority, historical-capture or privacy changes.
- No preview deployments or hosted data/schema writes during implementation.
- Test final shared PvE/PvP behavior and applicable spectator presentation.

## Review Focus

- 320px footer with long key, spectator count and conditional target confirmation remains usable without overflow.
- Chat draft and unread state survive toggle/rotation; text entry never issues a battle command.
- Log/history, nested readers and Terrain never stack over each other or change battlefield dimensions.
- Zoom gesture callbacks cannot roll back a newer value or create a camera jump; lock still wins.
- Offline training never creates online liveness; missing historical evidence stays unknown.

### Task 1: Mobile workspace, footer and cooldown

Files: shared battle experience, per-battle UI state/hook, chat bridge and utility windows, Chronicle props, mobile styles, cooldown styles and production browser fixture.

Interfaces: workspace values actions/log/chat shared by battle session id; current-round toggle props pass through BattleLogPanel to MobileBattleChronicle. Existing message endpoints and combat intents remain unchanged.

- [x] Add failing interaction/geometry guards for gold-badge log toggle, real-chat-only toggle, one-row footer, cooldown centring and unchanged battlefield/intent counts.
- [x] Implement mobile-only cockpit replacements and compact footer. Preserve desktop paths and native focus/input ownership.
- [x] Run the focused fixture and adjacent unit tests, including nested dismissal, empty slots, pending commands, rotation and spectators.

### Task 2: Turn cues and special-action outcomes

Files: shared battle preview/status presentation and Chronicle tests/model only if a recorded omission is reproduced.

Interfaces: current authoritative lifecycle/localTurn/activeName drive visible status; recorded special-action entries use the existing Chronicle result model.

- [x] Add/render tests for local, enemy, terminal states and both special-action families including statuses, damage/recovery and hidden effects.
- [x] Apply bounded, non-flashing green/red treatment inside current preview geometry; repair only proven missing outcomes.
- [x] Verify playable mode parity and full outcome/privacy regressions.

### Task 3: World zoom

Files: map-renderer and related zoom helper/tests as established by reproduction.

- [x] Record deterministic desktop/mobile jitter evidence and a failing regression.
- [x] Make the smallest demonstrated rendering/feedback correction without touching movement authority.
- [x] Run map/zoom tests and real browser wheel/pinch/lock checks.

### Task 4: Presence and complete roster

Files: character selection/activity presence boundaries, directory service/formatter and tests; SQL migration only if investigation proves necessary.

- [x] Reproduce a selected/actively training character missing activity and a roster over the Data API cap.
- [x] Record genuine authenticated activity through the existing authority; keep offline progression separate and unknown history explicit.
- [x] Verify ownership/deletion checks, heartbeat failures, selected-character switching and stable complete-directory results.

### Task 5: Integrated gate and review

- [x] Review the full diff for regressions and unrelated churn; obtain one independent whole-branch review.
- [x] Run quality, production build and affected browser matrix once on the final integrated source; use bounded workers to avoid the prior OOM.
- [x] Refresh main and reconcile PR #970 World diagnostics; preserve diagnostic clocks, capture bounds and strict movement assertions.
- [ ] Publish the verified source for configured native CI and inspect real results. Retain the deployment lock and report source/status without claiming live or human acceptance prematurely.
