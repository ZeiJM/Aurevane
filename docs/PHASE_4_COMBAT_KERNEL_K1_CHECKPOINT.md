# Phase 4 Combat Kernel v2 — P4.K1 Checkpoint

**Status:** implementation complete; exact-head verification required before integration.
**Branch:** `agent/combat-kernel-v2-hardening`
**Parent program:** `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md`

## Delivered K1 contracts

- branded/opaque kernel IDs for battles, combatants, action definitions, status definitions, tactical entities and trigger chains;
- typed positive ruleset/content versions;
- runtime-validated combat action provenance, including canonical source-kind validation;
- shared exhaustiveness guard for authoritative discriminated unions;
- compatibility-preserving persisted encounter -> normalized runtime encounter boundary;
- canonical mapping from the current persisted action-source vocabulary into the future Kernel vocabulary;
- public `@aurevane/game-core` exports for the new Kernel contracts.

## Compatibility ruling

K1 does not change damage formulas, AP/MP costs, DoT behavior, recovery, displacement, targeting or published Skill balance. Historical encounter slices remain readable and are normalized only when code explicitly opts into the stronger runtime boundary.

## Browser regression reconciliation

The effect-taxonomy work intentionally changed canonical presentation vocabulary. Browser expectations that still asserted retired labels were updated to the current taxonomy rather than changing runtime/UI behavior back to legacy wording.

## Verification requirement

The final K1 head must pass the exact-head repository quality gate plus the relevant browser/buildcraft regressions before merging into `agent/combat-effect-taxonomy-rework`. No deployment is authorized by this checkpoint.
