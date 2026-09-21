# Profile / Discipline / Battle Scaling Testing Pass

## 2026-09-20 — Level 100 / Adventure Stat / combat-power rewrite

- The current Level cap is restored to **100** through progression curve version 3; existing XP is preserved.
- Non-focus Core Stats now cap at **40** for current class/Primary identity policies.
- Derived Stat Ruleset V3 makes Profile grouping mechanically exact:
  - Might → Physical Power
  - Finesse → Accuracy + Critical Chance
  - Vitality → Maximum HP + Armor
  - Agility → Initiative + Movement + Jump + Evasion
  - Intellect → Maximum MP + Mystic Power
  - Resolve → Ward + Status Resistance
- Level contributes to Physical Power and Mystic Power, giving every class an offensive baseline even without Might/Intellect focus.
- New battle snapshots use stat-driven combat rules v3.
- Basic Attack now reads Physical Power rather than reaching directly into Might/Finesse.
- Damaging regular Skills use Physical Power by default or Mystic Power when tagged `mystic`.
- The current Skill-wide Power coefficient is 25%, distributed across direct multi-hit damage effects.
- Repeat-use falloff also halves the Power coefficient.
- Persisted v1/v2 battle snapshots retain their historical damage behavior.

The sections below record the earlier 2026-09-09 testing pass and remain historical context where superseded by the rules above.

This document records the owner-requested testing changes implemented together on 2026-09-09.

## Profile Attribute Management

- Full attribute spend/reset controls are moved out of the permanent Profile layout into a dedicated modal.
- The Profile retains a compact Attribute Management bar and a prominent red Reset / Redistribute action.
- Unspent attribute points surface the same modal in spend mode.
- Open modal state is represented in the Profile URL so browser refresh preserves it.
- Backdrop dismissal does not spend or discard points.
- Reset count, renewal timing, focus attributes and active Primary caps remain visible in the modal.

## Discipline Management

- Discipline Management uses a larger modal workspace with distinct Foundation sigils and focus-stat badges.
- Proposed Primary and Secondary lists are mutually exclusive: a proposed slot is hidden from the opposite slot's choices.
- Primary previews show preserved Core Stats and authoritative Adventure Stat changes.
- Increase/decrease/unchanged states use green/red/neutral presentation.
- Secondary remains stat-neutral and never contributes a second Primary base-stat profile.
- During the current testing phase, every player character receives auditable mastery access to all currently active Secondary-enabled Disciplines. Disabled/future content remains unavailable.

## Adventure Scaling

- Derived Stat Ruleset V2 spreads reliability and mobility growth across Levels 1–50.
- Level-1 Critical Chance, Evasion, Movement and Jump are deliberately kept far from endgame ceilings.
- Accuracy, Initiative and Status Resistance also receive revised Level-aware scaling.
- Existing HP, MP, Power, Armor and Ward formulas remain intact.
- Existing hard ceilings remain intact: Crit 30%, Evasion 15%, Movement 5, Jump 3.

## Battle Movement

- Player battle movement budget is created from the character's committed Primary-derived Movement value.
- AP remains the movement cost gate at 20 AP per terrain-cost point, but AP cannot buy movement beyond Movement Remaining.
- Provisional movement can be retracted before commitment; committing is the only point at which Movement/AP are consumed.
