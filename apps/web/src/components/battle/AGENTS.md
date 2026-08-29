# AUREVANE Battle UI — Permanent PvP/PvE Parity Rule

This file is the scoped maintenance authority for code under `apps/web/src/components/battle/`.
It supplements the repository-root `AGENTS.md` and exists specifically to prevent PvP and PvE
battle presentation from drifting apart again.

## Canonical presentation direction

- **Playable PvP is the canonical visual/presentation reference for shared battle UI.**
- PvE / AI Battles must inherit every applicable PvP presentation change by default.
- When changing PvP presentation, explicitly classify the change as **desktop**, **mobile**, or
  **both**, then apply the same applicable change to PvE in the same work item.
- Do not maintain a second visually independent PvE implementation when a shared component,
  semantic hook, layout contract, token, style rule, or presentation helper can express the same
  result for both modes.
- Prefer the existing shared battle visual contract and shared battle components over duplicated
  PvP-only and PvE-only overrides.

## Allowed mode-specific exceptions

Parity is not required for an element or behavior that exists only because of a mode-specific
mechanic. Keep those differences additive and isolated.

Examples of valid PvP-only differences include spectator/spectation controls, spectator or battle
keys/links, PvP-specific presence/transport concerns, and other multiplayer-only affordances.
Examples of valid PvE-only differences include recruit-specific behavior, AI/Battle Hall guidance,
and other mechanics that have no PvP equivalent.

A mode-specific exception does **not** justify changing the surrounding shared geometry, scale,
palette, typography, battlefield treatment, command presentation, combat log presentation, terrain
legend treatment, token presentation, header/footer styling, or responsive behavior unless the
mechanic genuinely requires that difference.

## Required workflow for battle presentation changes

1. Refresh current repository truth before editing; do not trust an old screenshot or prior chat
   claim over current code/production.
2. Identify the current approved PvP behavior at the requested breakpoint(s).
3. Trace whether the affected surface is shared, PvP-only, PvE-only, or accidentally duplicated.
4. Implement the change in the shared authority whenever practical so PvP and PvE cannot drift.
5. Preserve combat legality, server authority, rewards, PvP behavior, and other mechanics unless
   the task explicitly requires a mechanical fix.
6. Check both playable PvP and PvE at every affected breakpoint before declaring the visual change
   complete.
7. Add or update focused parity/regression coverage when a practical automated boundary exists.
8. If a PvP visual change intentionally must not flow to PvE, document the concrete mode-exclusive
   reason in the code/change rather than silently allowing divergence.

## Battle-log rule

The combat/battle log is a shared presentation surface. Opening, closing, docking, sizing,
scrolling, surrounding battlefield geometry, and terrain-legend behavior should match between
playable PvP and PvE wherever their mechanics are equivalent. PvE terrain information must not be
removed merely because the shared log is open.

The goal is simple: an applicable PvP presentation improvement should normally require **one shared
change**, not a later cleanup ticket to make PvE look the same.
