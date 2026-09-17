# CSR-3 Historical Battle Privacy Implementation Plan

**Date:** 2026-09-17

**Goal:** Extend the CSR-0 private privacy journal into authoritative historical battle-log projection so Covert command identity and protected positive-status lifecycle details remain private to unauthorized viewers, while successful Sensory reveal facts become public from the approved reveal boundary onward without retroactive disclosure.

**Scope:** CSR-3 only. No CSR-4 UI redesign, staged status-copy publication, temporary-Skill Copy, deployment, or merge to `main`.

## Authority to preserve

- `app_private.battle_privacy_journal` stays private, append-only, and keyed one row per committed battle version.
- `commit_battle_intent_v3` continues DB-stamping command-start actor/team provenance and exact event count.
- Browser event RPCs continue exposing no journal metadata.
- One committed battle version is one command event batch; hidden child events can therefore be collapsed by version without inventing a second resolution identity.
- CSR-2 viewer entitlement remains authoritative for participant/ally/opponent/spectator relationships.

## Implementation

### Commit-time privacy metadata

Add typed privacy metadata to `CommitBattleIntentInput` and pass it to `commit_battle_intent_v3` instead of the current unconditional `null`.

Create a server-only builder receiving the authoritative pre-command state, post-command state, command kind, and exact event batch. It must:
- mark an ordinary `action` command `team-only(actorTeamId)` when its actor had Covert at command start;
- keep movement, facing, timeout, surrender, turn/lifecycle/system commands public;
- walk events in committed order and persist team-only overrides for protected positive-status lifecycle facts targeting a combatant that is Covert at that event boundary;
- classify positivity from pinned/versioned combat status definitions, never presentation labels;
- fail closed for unknown/mismatched status identity where a protected lifecycle fact would otherwise be disclosed;
- persist public overrides for the approved successful Sensory purge/Covert-removal/Revealed boundary while never changing event count/order.

### Service-only historical privacy authority

Add a migration/RPC that:
- authorizes persisted participants or active PvP spectators;
- returns only server-required viewer entitlement plus requested private journal rows;
- treats missing journal rows as legacy public history;
- grants execute only to `service_role` with a hardened `search_path`;
- does not change browser-facing event RPC shapes.

### Viewer-relative history projection

Project persisted events by `battleVersion` before presentation sanitization:
- legacy/no-journal versions stay public;
- authorized team viewers see the full command subject to event overrides;
- unauthorized hidden ordinary commands collapse to one generic action entry and omit hidden child events;
- explicit public Sensory reveal events remain visible even if the command itself was hidden;
- team-only event overrides hide protected positive lifecycle facts from opposing viewers and spectators;
- current Covert/Revealed state is never used to reinterpret old history.

The generic event endpoint must continue to work for both participants and active spectators. Pagination must not split or duplicate a collapsed hidden command when a raw event cursor lands inside one battle version.

## Tests-first matrix

1. Covert-start action: opponent receives one generic action entry only, with no action ID/name, target, cost, hit/miss, effects, or child event count/order.
2. Self/ally receives full history for the same command.
3. Spectator receives the unauthorized projection.
4. Movement/facing/turn/timeout/surrender/system history stays public.
5. Visible actor buffs a Covert target: action identity stays visible while target positive lifecycle is hidden.
6. Positive apply/refresh/stack/remove/expire lifecycle is hidden while target is Covert.
7. Negative lifecycle remains visible.
8. Successful Sensory keeps pre-boundary facts hidden and makes approved purge/Covert-removal/Revealed facts public from the reveal boundary.
9. Later Revealed or natural Covert expiry never retroactively exposes prior hidden history.
10. Missing journal row preserves legacy public behavior.
11. Unknown/mismatched protected status metadata fails closed.
12. Pagination does not duplicate a collapsed hidden command.
13. Public event RPCs still expose no journal fields.
14. Browser roles cannot execute/read private history authority.
15. Persisted eventCount matches the exact event batch.
16. Command-start Covert is sampled before command mutations.

## Expected files

- `packages/db/src/battle-session.ts`
- `apps/web/src/server/battle/battle-history-privacy.ts`
- `apps/web/src/server/battle/battle-history-privacy.test.ts`
- `apps/web/src/server/battle/battle-session-service.ts`
- `apps/web/src/server/battle/battle-recruit-ai-service.ts`
- `apps/web/src/server/battle/supabase-battle-session-repository.ts`
- `apps/web/src/server/battle/battle-log-service.ts`
- `apps/web/src/server/battle/battle-log-service.test.ts`
- new `supabase/migrations/20260917*_battle_history_privacy.sql`
- battle privacy DB regression coverage.

Additional commit call sites receive explicit public privacy only when compilation/tests prove they use `commitBattleIntent`; do not broaden behavior speculatively.

## Verification gate

RED intended behavior -> minimal implementation -> targeted green -> full formatting/lint/typecheck/tests/build -> database rebuild/privacy regression -> Browser smoke -> exact PR diff/reviews/comments -> refresh shared -> exact candidate merge -> verify merge parents/tree -> post-merge shared checks -> confirm `main` untouched.
