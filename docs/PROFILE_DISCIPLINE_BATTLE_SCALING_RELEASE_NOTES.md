# Profile / Discipline / Battle Scaling Testing Pass

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
