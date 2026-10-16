### Spec Compliance

- ❌ **Issues found:** Four Resonances reproduce tools already present in their proposed four-Skill kits, with additional restrictions or worse prices but no new present-day payoff. They fail the required experiential pair-identity gate.
- ✅ Reviewed all294 identities and typed designs, all153 class Skill/Essence plans, all17 class cycles and Library tiers/loadouts, and all136 pair combinations. The inventory is complete; the four findings below are the remaining design blockers.
- ⚠️ **Cannot verify from this design diff:** actual player controls, previews, Ground canonical integration, Library presentation, whole-roster AI/PvE/PvP and Level100/twelve-round balance. These correctly remain Task15/16 gates (`docs/verification/2026-10-16-complete-roster-design.md:62`, `:64`, `:66`). Current hosted inventory and remote-main reconciliation remain controller-supplied evidence.

### Strengths

- ✅ Actual source/digest, identity, eligibility, media, immutable-version and canonical-presence guards protect the complete inventory; five Basics are explicitly retained (`packages/game-core/src/combat/roster-design-manifest.test.ts:90`, `:105`, `:143`).
- ✅ All153 class records now contain individual state, counter and opportunity-cost plans. All17 Library tiers have justified earned loadouts and explicitly describe decision burden rather than strength (`packages/game-core/src/combat/roster-design-manifest.test.ts:159`, `:356`; `docs/superpowers/specs/2026-10-10-roster-rebalance-coverage.json:17913`).
- ✅ Hundredfold Rush and Sevenfold Cut now differ through approach/exit decisions and immediate versus captured future pressure. Actual tests cover Sevenfold restore, source removal, preboundary Barrier and terminal rejection (`packages/game-core/src/combat/roster-design-outcomes.test.ts:159`, `:175`).
- ✅ The previously identified reaction and sustain defects are concretely addressed: useful Automatic gates, finite mana rebate, action-completion misses, and confirmed-hit recovery through full Barrier absorption (`packages/game-core/src/combat/roster-design-outcomes.test.ts:339`, `:358`, `:391`, `:408`).
- ✅ Coverage is checked against actual effect/status registries and typed Requirement nodes; Ground remains honestly provisional with a bounded parser/compiler/capture/lifecycle contract (`packages/game-core/src/combat/roster-design-manifest.test.ts:219`, `:228`, `:264`; `docs/superpowers/specs/2026-10-10-roster-rebalance-coverage.json:18145`).
- ✅ Verification receipts are present and clean:828 passing tests, typecheck, lint, formatting and frozen-lockfile installation. The828 comprise735 guards,29 candidate outcomes and64 retained contracts;1520 cases remain plans. No passing suites were rerun (`.superpowers/sdd/2026-10-10-unified-engine-recovery/verification.jsonl:88`, `:89`, `:90`, `:91`, `:33`; `docs/verification/2026-10-16-complete-roster-design.md:19`, `:45`).
- ✅ Focused outside-diff risks checked: plural `primary-unit` packets are promoted to affected recipients (`packages/game-core/src/combat/combat-targeting-shapes.ts:59`); Physical-only action Requirements are actually evaluated (`packages/game-core/src/combat/combat-requirements.ts:278`); canonical accuracy shares a recipient result across packets (`packages/game-core/src/combat/actions.ts:335`). No additional runtime change is required by these checks.

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

1. **Borrowed Formula adds a worse copy of equipped Quick Hands.**  
   `docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json:43810` defines35AP/5MP, cooldown3, ownerMP≥8, range1–2, one enemy donor and instant Copy Buffs to Self. Quick Hands already provides the same targeting, recipient, timing and copy operation for35AP/**4MP**, cooldown3, without the reserve Requirement (`:10241`). The proposed kit explicitly equips Quick Hands (`:44007`). Aetherist resource preparation enables payment but does not create another interaction or payoff. Apart from an independent cooldown, this is the same donor-selection command with a penalty. Author a distinct Aetherist/Shadehand choice and a concrete outcome demonstrating its value beside Quick Hands.

2. **Pursuit Angle repeats equipped Flanking Cut without rewarding quarry preparation.**  
   `docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json:58275` defines50AP/4MP, cooldown3, prior Mark, then Move1 → Self Blindside1 → instant Physical Power11. Equipped Flanking Cut has the same geometry, recipient order, clocks and scaling for50AP/**3MP**, cooldown3, **Power13**, and no Mark Requirement (`:20629`; kit reference `:58529`). Mark introduces another setup obligation without changing the action or producing a new payoff. Replace this with a meaningful quarry/angle interaction; another weaker Flanking Cut on a separate cooldown does not satisfy the pair brief.

3. **Piercing Inscription has no present advantage over equipped Aimed Shot.**  
   `docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json:59681` defines a Mark-required, single-target Physical Pierce13 shot at range2–5 for50AP/5MP and cooldown3. Aimed Shot already supplies the same targeting lane, Physical scaling and instant enemy recipient for45AP/**0MP**, **Power14**, cooldown2 and no setup (`:6530`; kit reference `:59889`). The50% equipment Armor bypass (`:59739`) is explicitly future-only and provides no current advantage. The claimed defense-family distinction therefore does not distinguish this action from its actual Farstrider tool. Give the pair an observable present-day interaction rather than relying on future Armor or an extra attack cooldown.

4. **Burn the Thicket makes two setup states buy an inferior Cinder Bolt.**  
   `docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json:69392` defines50AP/6MP, cooldown3, required Mark, Fire Power9 and a15% decaying Burn conditional on prior Poison. Cinder Bolt already supplies the same range1–4, enemy recipient, Mystic scaling, instant Fire timing and actor Chilled cleanse for45AP/**5MP**, cooldown2, **Power10** and **20% Burn without either setup** (`:27979`). Both Burns have three-turn duration and500-basis-point decay. The actual pair kit equips Cinder Bolt, Hunter’s Mark and the Poison Ground tool (`:69651`, `:69671`, `:69681`), but completing that hunting preparation yields no new or improved outcome. Make the prepared Poison/Mark state change a real decision or payoff, then update its acceptance plan and pair audit.

#### Minor (Nice to Have)

- None separately identified. The scalar-stripped signature screen remains useful, but its136 distinct hashes do not answer the four equipped-tool comparisons above (`packages/game-core/src/combat/roster-design-manifest.test.ts:378`, `:455`).

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** The manifest, contracts, guards and evidence boundaries are carefully constructed, and the complete class scope is present. Acceptance is blocked by four concrete pair designs that offer weaker repetitions of their own proposed kit tools; resolving those experiential failures is within Task14 and does not require premature Task15 activation or whole-roster balance approval.
