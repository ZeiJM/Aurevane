# Balance Content

This directory holds non-authoritative balance inputs, review fixtures and playtest evidence. Authoritative combat values remain in versioned server/game-rule content; client presentation must never become the sole source of tuning.

## A03 Phase 4 balance harness

The deterministic A03 harness lives in `packages/game-core/src/combat/phase4-balance-harness.ts`. It is an analysis surface, not a second combat engine: it consumes the current Discipline policies, derived-stat calculator, mature Skill/Essence/Resonance registries, AP-aware damage-scaling helpers, mitigation rules and current combat content.

The harness covers all **17 published Disciplines** at Levels **25, 50 and 100**, with both balanced and offensive representative allocations. Its fixed comparison fixture currently uses Armor/Ward 100, Evasion 500, a 20 AP normal movement tile and an explicit four-target area assumption. These constants make comparisons repeatable; they are not claims about a universal opponent or encounter.

Reported dimensions remain separate:

- Basic, direct, positional and attrition damage per 100 AP;
- setup → payoff damage over the **combined** setup and payoff AP budget;
- healing/recovery, protection and control/AP swing;
- maximum range and explicit area-target assumption;
- MP spend and recovery;
- consecutive-repeat efficiency;
- pure Essence dimensions;
- the sixteen mixed Resonance pairs available to each Discipline.

There is deliberately **no aggregate class power score**. Raw damage cannot fairly substitute for range, control, healing, mitigation, conditions, risk or positional requirements.

A setup Skill counted by the setup/payoff metric must itself be immediately usable; the harness does not hide a second prerequisite behind the advertised two-command sequence.

## A03 class-specific outcome

After the systemic v4 changes—AP-weighted Power scaling, 15% Basic Attack scaling, authoritative Critical Chance and normalized mystic MP costs—the regular 17-Discipline kits remain role-differentiated without a blanket numerical rewrite.

The evidence-backed class-specific potency correction is **Edgedancer Sevenfold Cut v3**: seven direct packets advance from base 3 to base 4. Historical v2 remains seven base-3 packets. This brings the pure Essence back into the intended competitive range while leaving Edgedancer's stronger positional ceiling intact.

The existing `phase4-playtest-results-template.csv` remains the human test ledger. Automated harness output supports A03 engineering balance review; it does not close A04 human build/pair differentiation or replace actual playtesting.
