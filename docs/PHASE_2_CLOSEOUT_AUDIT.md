# AUREVANE — Phase 2 Closeout Audit

**Closeout date:** 2026-09-02  
**Final tested production baseline:** `main` at `1355fbd710c480ca1d075254a5559568708bde3c`  
**Status:** **PHASE 2 CLOSED by explicit Owner decision. Phase 3 is authorized to begin at P3.1.**

## Closure evidence

The final Phase-2 correction was merged as PR #366 and deployed from the exact merged `main` commit above. Vercel reported that deployment `READY`, with the production alias `aurevane.vercel.app` assigned, and the production root returned HTTP 200.

The final affected battle-input release gate passed:

- 4/4 focused tests in Chromium;
- 4/4 focused tests in real Microsoft Edge;
- stable Recovery slot routing after HP ↔ MP Recovery swapping;
- Guard first-press preview / second deliberate press commit;
- narrow desktop resize plus Inspect dismissal followed immediately by hotkey execution;
- repeated two-player PvP Space → Space Finish Turn handoffs while preserving facing;
- OS `KeyboardEvent.repeat` never counting as the second deliberate press.

After testing the live deployment, the Owner explicitly stated that it “works perfectly” and that this brings Phase 2 to a close.

No tester counts, ratings, session statistics, or other human evidence are fabricated by this closeout.

## Phase-2 implementation truth

Phase 2 delivered substantially more than the original tactical-combat minimum. The reusable platform now includes:

- deterministic server-authoritative tactical combat;
- the 100-AP Action Economy;
- movement/pathing/terrain/elevation/facing;
- target/requirement/effect/status foundations;
- persisted/reconnect-safe battle sessions;
- PvE Recruit AI and Battle Hall sparring;
- direct PvP lobbies and shared battles;
- multi-combatant formats;
- battle communication, timing and reconnect foundations;
- keyed read-only spectation with spectator presence/chat/logs/Inspect;
- responsive desktop/mobile battle presentation;
- shared PvE/PvP battlefield presentation;
- stable cockpit action categories and slot-owned hotkey foundations;
- same-slot HP/MP Recovery swapping as an early reusable Skill-selection proof;
- battle logs, forecasts and Inspect.

Phase 3 must build **on top of** this platform rather than recreate battle UI, PvP, spectation, hotkeys, or basic action-selection surfaces.

## Root causes closed in the final Phase-2 regression

The final reliability investigation identified several interacting presentation/input defects rather than one browser-specific keycode issue:

1. viewport width was incorrectly participating in keyboard ownership, allowing desktop resize to switch between shared and legacy handlers;
2. Inspect could visually close while leaving the underlying battle planning mode active;
3. a layout stabilizer could re-hide the Final Facing surface after React had correctly opened it;
4. an obsolete CSS rule treated Final Facing as permanently hidden;
5. the regression test itself initially assumed a literal `data-local-turn="false"` state although the non-local contract removes the attribute.

The shipped fix made keyboard ownership independent of viewport width, kept fine-pointer desktop presentation through narrow resizes, gave Inspect a real lifecycle close path, and made the stabilizer yield to authoritative React open state.

## Phase-3 credit discovered during Phase 2

Reusable early-compatible foundations already exist:

- four battle cockpit operational categories: `movement`, `attack`, `defense`, `heal`;
- stable slot keybind identities that survive visible action changes;
- action-selector versus action-execution separation;
- artwork/media hooks for cockpit actions;
- shared PvE/PvP cockpit behavior;
- HP Recovery / MP Recovery swapping in one category;
- existing preview/target/confirm routing through authoritative combat paths.

These foundations do **not** complete mature Phase-3 buildcraft. Phase 3 still requires:

- authoritative persistent build state;
- versioned Discipline definitions;
- Primary base-stat profiles;
- Secondary authority and independent attunement cooldowns;
- mature Skill schema and generic cooldown engine;
- legal pure-8 / mixed-6 persistent capacity;
- Resonance and Essence;
- committed build snapshots shared across AI/PvP/loadouts;
- the representative PV-2 buildcraft slice.

## Phase-boundary platform checkpoint

The automatic Phase-2 performance/security checkpoint was rerun during closeout.

Observed:

- Supabase project status: `ACTIVE_HEALTHY`;
- production Vercel baseline: exact Phase-2 merged commit `READY`;
- Supabase performance advisor: informational unused-index candidates only;
- Supabase security advisor: informational RLS-enabled/no-policy notices and a warning that leaked-password protection is disabled.

No Phase-2 gameplay regression or authority failure was identified by those advisories. Unused indexes are not removed without measurement/reference evidence. Security advisories remain deliberate hardening follow-up; do not create permissive RLS policies just to silence a linter when a table is intentionally server-only/fail-closed.

## Repository hygiene completed at closeout

Removed historical scaffolding with no player/runtime authority:

1. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part02`
2. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part03`
3. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part04`
4. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part05`
5. `.github/workflows/bootstrap-master-plan.yml`
6. `.github/workflows/format-auth-shell-once.yml`
7. `.github/final-format-auth-shell.trigger`

Why removal is safe:

- canonical `docs/GAME_MASTER_PLAN.md` already exists;
- the bootstrap workflow existed only to reconstruct that document from the split payloads;
- the authenticated-shell formatter was a branch-specific one-shot workflow;
- its trigger literally said `Remove before merge`;
- none participate in Next.js runtime, combat authority, Supabase migrations, or Vercel application behavior.

Stale Phase-2 implementation PRs are closed as superseded rather than merged into the now-tested production baseline.

Runtime components are **not** deleted merely because an older branch once identified them as apparently dead. Future runtime cleanup still requires fresh current-main reference evidence and normal validation.

## Phase-3 starting posture

Phase 3 is now the active feature phase. Start at:

```text
P3.1
Persistent build authority
+ versioned Discipline definitions
+ Primary Discipline identity
+ Primary base-stat profiles
+ deterministic derived-stat recomputation
+ Profile preview/commit flow
```

The existing four cockpit categories are presentation/action-selection categories, not the persistent build-capacity contract. Canonical Phase 3 remains:

```text
Pure:  up to 8 Primary Discipline Skills + 1 Essence Skill outside the cap
Mixed: 6 total Discipline Skills across Primary + Secondary + Resonance passive
```

The complete committed build snapshot must remain authoritative, and both human cockpit selection and AI legality must derive from it.

No Phase-3 runtime code is included in this closeout commit.
