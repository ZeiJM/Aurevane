# Frozen Ground Skill AP surcharge — October 31, 2026

Implementation only; no publication, migration or deployment.

## Captured contract

New `freeze-ground` authoring creates `create-terrain` with an explicit
`skillApSurcharge: 10`. The shared payload registry accepts integer values from 0 to 100.
The field is copied into immediate and delayed terrain projections, receipts and overlays.
Absent fields retain the historical 10 AP walking surcharge and its captured team policy;
there is no definition, saved encounter or history rewrite.

An explicit profile replaces the walking surcharge. It adds its captured value to a paid
Skill action used from that tile by an enemy of the terrain's source. Allies and active
Airborne holders are exempt. Paid Discipline Skill, Essence and Resonance action behaviors
share the canonical cost authority, including automatic actions that already spend AP.
Basic actions and modifier behaviors remain exempt, and free automatic reactions gain no
new AP cost. The terrain price is a flat addition after the existing status cost adjustment;
it does not scale damage or recovery power.

Forecasts and commits use the same cost and affordability authority. Delayed activation
and JSON restore retain the profile. Refresh replaces the overlay rather than stacking;
normal two-boundary expiry remains authoritative. Fire removes the Skill AP profile when
converting Frozen Ground to Steam and preserves the remaining lifetime under the existing
elemental policy. Shared Skill/Ability readers, terrain inspection, the terrain key and
Chronicle descriptions distinguish explicit Skill AP profiles from historical movement
profiles. Terrain summary grouping keeps different saved surcharges separate.

## Evidence

Tests were added and observed failing before implementation for the new payload default,
capture, movement exemption, actual native/canonical payment, paid automatic Resonance
payment, affordability and new-profile readers. Historical movement tests remain in place.

- Full game-core suite: 207 files, 5,853 tests passed.
- Final affected game-core recheck: 146 tests passed, including explicit profile expiry.
- Seven affected/adjacent web reader and log suites: 147 tests passed.
- Game-core TypeScript check and web `tsc --noEmit`: passed.

The combined batch still requires its final integrated repository quality and native
browser gates. No signed-in browser, production or physical-device acceptance is claimed.
