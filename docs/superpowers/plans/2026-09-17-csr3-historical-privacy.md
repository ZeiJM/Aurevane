# CSR-3 Historical Battle Privacy Implementation Plan

**Date:** 2026-09-17

**Goal:** Extend the existing CSR-0 private battle privacy journal into authoritative historical battle-log projection so Covert command identity and positive-status lifecycle details remain private to unauthorized viewers, while successful Sensory reveal events become public from the approved reveal boundary onward without retroactively disclosing earlier history.

**Scope:** CSR-3 only. No CSR-4 UI redesign, no staged status-copy publication, no temporary-Skill Copy, no deployment, and no merge to `main`.

## Current authority to preserve

- Shared combat integration branch is the only target for this work.
- `app_private.battle_privacy_journal` is private, append-only, one row per committed battle version.
- `commit_battle_intent_v3` DB-stamps command-start actor/team provenance and exact event count.
- Public/browser event RPCs must remain free of private journal metadata.
- One committed battle version is one command event batch, so hidden child events can be collapsed by version without adding a new resolution identifier.
- CSR-2 viewer entitlement remains the source of truth for live participant/spectator relationships.

## Design

### 1. Persist caller visibility decisions at commit time

Add typed privacy metadata to `CommitBattleIntentInput` and pass it to `commit_battle_intent_v3` instead of the current unconditional `null`.

Create a server-only privacy metadata builder that receives:
- authoritative pre-command encounter state;
- authoritative post-command encounter state;
- command kind (`action`, `move`, `face`, AI ordinary action, timeout, surrender/system);
- exact committed event batch.

The builder must:
- mark an ordinary action command `team-only(actorTeamId)` when its actor had Covert at command start;
- keep movement, facing, timeout, surrender, turn/lifecycle/system commands public;
- walk events in committed order and emit `team-only(targetTeamId)` overrides for positive-status lifecycle facts targeting a combatant that is Covert at that event boundary;
- determine positivity from the pinned/versioned PV-1F status catalog, never presentation labels;
- fail closed for unknown/mismatched status definitions when a lifecycle fact would otherwise reveal protected state;
- on successful Sensory, make the approved purge/Covert-removal/Revealed events public from the reveal boundary onward, while older hidden entries remain hidden forever;
- preserve exact `eventCount` alignment by never changing event order/count while building metadata.

### 2. Add a service-role-only historical privacy read seam

Add a new migration with a service-role-only RPC for battle-history privacy context. It must:
- authorize either a battle participant or an active PvP spectator using the same persisted authority used by current event access;
- return viewer kind/team entitlement needed to evaluate `team-only` visibility;
- return only the requested private journal rows/version range to the server;
- treat missing journal rows as legacy public history;
- expose no private journal data to `public`, `anon`, or `authenticated` roles;
- use `SECURITY DEFINER` only with an explicit hardened `search_path`.

Do **not** change the browser-facing shape of `get_battle_events_v3` or `list_pvp_battle_events_v2`.

### 3. Make event repository history access spectator-compatible

The current generic battle-log repository calls participant-only `get_battle_events_v3`, while the spectator surface consumes the same `/api/battles/{session}/events` endpoint. Route history reads through server authority that preserves both participant and active-spectator access (using the existing PvP event authorization or an equivalent server-only access seam), without exposing extra metadata to the browser.

### 4. Project persisted history by viewer

Extend battle-log service dependencies with a private-history authority repository and project records grouped by `battleVersion` before presentation sanitization.

For each version:
- no journal row => legacy/public behavior;
- viewer authorized for command visibility => keep visible child events, subject to event overrides;
- viewer unauthorized for a hidden ordinary command => emit one generic action entry (`<Combatant> performed an action.`) and omit hidden child events;
- explicit public event overrides after a Sensory reveal boundary remain visible even when the command itself is hidden;
- team-only event overrides hide positive lifecycle facts from opposing participants and all spectators;
- do not infer old visibility from current Covert/Revealed state.

Pagination must not duplicate or split the generic collapsed representation. Fetch/version grouping must preserve deterministic cursor behavior.

### 5. Tests-first matrix

Add RED tests before implementation for:
1. Covert-start ordinary action: opponent receives one generic entry only; no action id/name, target, AP/MP, hit/miss, effects, event count/order.
2. Same hidden action: self/ally receives full history.
3. Spectator receives the same unauthorized projection.
4. Movement/facing/turn/timeout/surrender/system history stays public.
5. Visible ally buffs a Covert target: action identity stays visible; target positive lifecycle is hidden.
6. Positive apply/refresh/stack/remove/expire lifecycle is hidden while target is Covert.
7. Negative lifecycle remains visible.
8. Successful Sensory: pre-boundary hidden facts remain hidden; approved purge/Covert removal/Revealed facts are public from reveal boundary onward.
9. Later Revealed or natural Covert expiry never retroactively exposes earlier hidden history.
10. Missing journal row preserves legacy public behavior.
11. Unknown/mismatched privacy/status metadata fails closed server-side.
12. Pagination does not duplicate a collapsed hidden command.
13. Public event RPCs still expose no privacy journal fields.
14. Browser roles cannot execute/read the private history authority.
15. Commit metadata event count exactly matches the persisted event batch.
16. Command-start Covert is sampled before the command mutates Covert state.

## Expected files

- `packages/db/src/battle-session.ts` — typed privacy commit/history contracts.
- `apps/web/src/server/battle/battle-history-privacy.ts` — commit-time visibility builder + pure projection helpers.
- `apps/web/src/server/battle/battle-history-privacy.test.ts` — RED/GREEN unit coverage.
- `apps/web/src/server/battle/battle-session-service.ts` — player command privacy metadata.
- `apps/web/src/server/battle/battle-recruit-ai-service.ts` — AI ordinary-command privacy metadata.
- `apps/web/src/server/battle/supabase-battle-session-repository.ts` — persist privacy payload and fetch private history context.
- `apps/web/src/server/battle/battle-log-service.ts` — viewer-relative historical projection before presentation sanitization.
- `apps/web/src/server/battle/battle-log-service.test.ts` — participant/spectator/pagination regression coverage.
- `supabase/migrations/20260917*_battle_history_privacy.sql` — service-only private-history authority.
- `.github/scripts/verify-battle-privacy-journal.sh` and/or battle-session DB verification — access, shape, rollback and non-leak regressions.

Additional call sites may receive an explicit public privacy baseline only if compilation/tests prove they commit through `commitBattleIntent`; do not broaden behavior speculatively.

## Verification and merge gate

1. RED tests fail for the intended missing privacy behavior.
2. Implement the smallest authority changes.
3. Targeted tests green.
4. Formatting/lint/typecheck/full tests/build green.
5. Database rebuild and privacy regressions green.
6. Browser smoke remains green.
7. Inspect exact PR diff, reviews, comments and review threads.
8. Refresh shared branch immediately before merge; reconcile if it moved.
9. Merge only the exact verified candidate SHA into `agent/combat-effect-taxonomy-rework`.
10. Verify merge parents/tree and post-merge shared workflows.
11. Confirm `main` remains untouched.
