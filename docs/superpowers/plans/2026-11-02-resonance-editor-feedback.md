# Resonance targeting, publication feedback and battle identity

**Owner requirements:** Resonance automatic actions must support Enemy, Ally and Ground targeting for every purpose. The Owner selected a rule configurable per Resonance (nearest, lowest HP or the trigger's unit) for targetless events such as Your Turn Starts. Custom Resonance artwork and names must appear in the cockpit and Chronicle; Ultra Instinct (Super Saiyan + Aetherist) is the concrete example. Commit must publish, not merely save a draft.

## Design and boundaries

- Retain existing causal `automaticTarget.subject` bindings and their historical semantics. Add explicit opt-in subjects `nearest-enemy`, `nearest-ally`, `lowest-hp-enemy`, `lowest-hp-ally` for canonical automatic actions. These are independently programmable for Attack, Defense/Utility and Recovery. Ongoing owner-bound passive modifiers retain their own contract.
- Enemy/Ally/Ground recipient tags remain in Effects; automatic selection chooses the unit used to aim the action. Ground uses the tile beneath the chosen unit, and the existing owner binding can aim at the caster's tile. Source-only payloads remain on the owner.
- Enumerate living matching units relative to the owner, excluding the owner from ally candidates; run canonical geometry, range, LOS, elevation, requirements and payment admission. Nearest sorts by Manhattan distance, then stable ID. Lowest HP means absolute remaining HP, then distance and stable ID. Skip illegal candidates. If none qualifies, suppress without payment, RNG changes or cooldown use. The owner remains caster/controller throughout.
- The editor shows these supported rules alongside existing trigger-unit choices, without weakening strict saved definitions or silently changing historical captures. Purpose alone must not hide valid targeting.
- Exact pinned immutable Resonance definitions/captures supply custom name and safe artwork identity to cockpit and Chronicle/clipboard. Never replace historical names with a current publication or enrich Covert/Reversal receipts whose action identity was intentionally removed.
- Local route-to-SQL tests and a bounded read-only check show Ultra Instinct version2 is published with its uploaded image. Keep the existing atomic Commit pipeline; repair misleading partial-success text so committed child changes are distinguished from uncommitted parent/newer edits. No hosted mutation is needed for diagnosis or implementation.

## Verification

- [ ] Core selector admission: turn-start and reaction triggers; all purposes; Enemy/Ally/Ground; shape/range/LOS/elevation; ties/dead/hidden/ineligible units; no-target no-op; no wrong-caster execution; historical causal fallback.
- [ ] Actual editor target/rule changes, strict serialization and current publication route; preserve existing passive/noncast presentation and owner permissions.
- [ ] Custom passive Resonance uploaded image in PvE/PvP; actual automatic activation through safe logs, exact pinned custom name/artwork in Chronicle/clipboard; missing/mismatched/hidden capture negatives.
- [ ] Commit modal partial-success wording and actual commit/draft/readback integration.
- [ ] Independent review and one combined final `pnpm check` plus relevant native browser checks on the assembled PR #1003 tree. No merge, hosted catalogue publication or deployment is included.

Final assembled verification: `pnpm check` passes 15,984 Vitest tests, seven Node tests, format/lint/types and production build; shared command-feedback and 76 targeting Chromium cases pass. See `docs/verification/2026-11-02-battle-support-feedback.md`. Source only, not live.
