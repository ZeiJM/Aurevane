# AUREVANE HQ Concept UI v1.1 Implementation Plan

**Date:** 2026-09-14
**Working branch:** `agent/hq-concept-ui-v11`
**Base:** current `main`

## Goal

Refine the already-landed approved concept UI toward the HQ page mockups while preserving every current player-facing route, gameplay control, server contract, and authoritative state path.

## Non-negotiables

- Preserve the current routes and functionality. Do not create functional links for concept-only systems that AUREVANE does not yet have.
- Do not deploy Production or Preview from this work unless explicitly requested.
- Character creation remains `Identity -> Discipline -> Confirm` and keeps name, presentation, portrait, starter appearance, Discipline, and Core Stat allocation.
- Pronouns are not shown in character creation or profile-facing UI. The existing server/domain pronoun field remains populated for backwards compatibility until a separate schema migration is approved.
- Starter character portraits and skill imagery used as square identity/icon art render at 1:1.
- Desktop is designed for 100% browser zoom. Primary workspaces should fit without body scrolling where practical; dense collections may use bounded internal scrolling.
- Existing combat, PvP, spectator, training, profile, account, online-user, manual, news, and rules behavior is preserved.

## Implementation sequence

1. Add domain tests for the hidden compatibility pronoun default and expanded starter portrait catalog.
2. Add a larger approved square starter-portrait catalog derived from the approved HQ character-creation concept art and route it through the existing media registry.
3. Remove visible pronoun controls and review output from character creation while deriving a compatibility pronoun preset from presentation for the unchanged API contract.
4. Rework the Identity workspace toward the approved HQ layout: dense square portrait library, bounded portrait scroller, dedicated selected-portrait preview, and environment art as sidecar rather than stretching an avatar as the page background.
5. Keep all current Identity fields and all Discipline/attribute behavior intact.
6. Audit profile-facing UI to ensure no pronoun label/value is rendered.
7. Compare the final branch against current `main`, inspect every changed file, and rely on repository CI/checks for verification because the local sandbox cannot resolve GitHub.

## Verification targets

- `@aurevane/game-core` tests and typecheck.
- Web typecheck/lint/build checks already configured in repository CI.
- No new route or gameplay-state mutations beyond the approved UI refinement.
- All starter portrait refs are unique, deterministic, and resolve to registered media.
- All starter portrait media descriptors are square.
- No visible `Pronouns` control or profile fact remains.
- No deployment action is performed.
