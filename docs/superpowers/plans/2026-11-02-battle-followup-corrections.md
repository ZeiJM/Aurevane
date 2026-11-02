# Cooldown isolation, All targets and Barrier returns

## Owner requirements and selected policies

- Using one Skill must not put unrelated Skills or Essence on cooldown.
- Targeting highlights must not extend to an illegal out-of-range aim or show stale affected markers. Legal area-effect extent beyond a legal aim center remains valid.
- All effects must support explicit friendly-fire configuration. The Owner selected moving the caster too for All Push/Pull: forward along facing for Push and backward for Pull.
- Reflect must return eligible damage absorbed by Barrier as well as actual HP damage. Audit Barrier/Reversal interactions without changing unrelated interception rules.

## Design

**Cooldowns:** Add encounter-pinned `abilityCooldownScopeVersion: 1` at explicit current creation boundaries. One central adapter derives collision-free clocks from source kind, ability identity and authored group key, excluding content version and source instance so intended same-ability sharing remains. Reserve only the engine-owned Guard/Recovery key combinations; edited Basics isolate too. Admission, payment, materialization, Controlled preparation, modifiers, AI and projections use the same key. Historical missing policy remains literal. Owned clocks stay visible; foreign snapshot keys are removed and foreign history identities remain opaque, including abort responses. Existing ambiguous active clocks are not reassigned.

**Range feedback:** Validate retained destination area anchors before trusting old affected footprints, including range, elevation and LOS. Use a current matching legal forecast for affected markers. Exact mounted Single outside-range tests characterize the existing legal potential path; regression repairs cover confirmed retained-anchor/stale-marker failures.

**All:** Existing explicit per-effect All already includes every living unit and summon, including caster; retained shape-All alone is a different inherited targeting contract. Add optional `allTargetPolicyVersion: 1` to authored targeting only on explicit current authoring/save. Adopting an unmarked All resets its previously ignored friendly-fire field to All units; deliberate subsequent choices remain. Under the new marker, explicit All intersects only the selected friendly-fire policy, not inherited team/footprint restrictions. Explicit Self/Ally/Enemy/Ground siblings keep their own targets. Historical unmarked All retains its old rules. New-marker All displacement applies the Owner's facing rule to the caster and uses a frozen logical-packet source origin for the other recipients; normal collision, terrain, immunity and defeat rules still apply. This is not a new implicit origin for ordinary Self displacement.

**Reflect:** Add encounter-pinned `reflectBarrierPolicyVersion: 1` at current creation boundaries. Reuse actual ordered Barrier absorption and matching Damage receipts to calculate HP loss + absorbed amount for Reflect only, preserving captured family/rate, overkill limits, misses, zero-damage behavior and non-recursive returns. No new private basis ledger or numeric public receipt is introduced. Historical absence remains HP-only. Current readers/logs carry only a qualitative policy marker. Existing Reversal waits for a hit reaching HP while Barrier absorbs; preserve that contract and test it against double settlement, wrong return basis and Barrier depletion.

## Verification and release boundary

- Reproduce real multi-ability raw-key collision before isolation; test same-ability sharing, versions, owners, custom Basic/native exceptions, current admission constructors, Controlled/automatic/modifier paths and reload/privacy.
- Test actual current All authoring/capture/commit with scaled Damage, all teams, summons, caster and mixed per-effect scopes; friendly-fire values, strict unknown/version guards, self displacement all facings/collisions and immutable historical behavior.
- Test full/partial/no Barrier, captured Reflect rates, family mismatch, misses/overkill, attacker Barrier, death, copied/automatic Reflect, Reversal and replay.
- Keep the existing relevant native desktop/mobile PvE/PvP/spectator checks and add focused regressions. Obtain independent reviews, then run one final full `pnpm check` on the assembled PR #1003 source.
- No hosted catalogue mutation, merge or application deployment is included. New encounter policy flags require a new battle after a later deployment; existing clocks/captures remain pinned.

Final assembled verification: `pnpm check` passes 15,984 Vitest tests, seven Node tests, format/lint/types and production build; shared command-feedback and 76 targeting Chromium cases pass. See `docs/verification/2026-11-02-battle-support-feedback.md`. Source only, not live.
