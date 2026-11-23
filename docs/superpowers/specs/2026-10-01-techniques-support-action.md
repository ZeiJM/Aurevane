# Techniques rows and Support Action

Owner scope (2026-10-01): show all eight available Primary Discipline Skills across one desktop row; all eight Secondary Skills across another row, or eight locked boxes when no Secondary is equipped. The Owner explicitly confirmed all eight in the Secondary row. A third row offers exactly one Support Action: Guard, HP Recovery or MP Recovery. The server-saved choice controls the existing battle slot 3. The Nexus summary and Techniques header label the four counted slots as Discipline Skills and show Support Action separately.

The four Discipline Skill capacity and existing mixed-source selection rules remain unchanged. Clear Selections clears only Discipline Skills. Guard is the default for legacy characters and legacy battle snapshots. Reuse the already implemented basic.guard, basic.recover and basic.recover.mp definitions, AP costs, shared recovery cooldown, resource requirements and server preview/commit paths; do not change combat potency or legality.

Support Action belongs to the character build, persists after reload and between sessions, and is included in saved loadouts. New AI/PvP battles pin the committed choice; changing the character build cannot mutate an existing battle. Historic snapshots and their fingerprints remain compatible. Retain the existing persisted guard keybind identifier for customized controls, labeling its role Support Action where useful. Reuse the single existing keyboard owner, deliberate second-press and held-key/dialog/stale-preview protections.

Desktop row layout must fit the established Techniques workspace without clipping. Preserve full previews and artwork borders; mobile may use its existing responsive flow. No new dependency, content publication, reward or gameplay rule is introduced. An additive, service-only migration is necessary for persistent character support choice and saved-loadout compatibility; deploy it only after the required exact-candidate database/security checks and final release preflight.

## Additional Owner-approved UI continuation

The Owner subsequently approved the generated Profile concept with Core Stats across one row, corresponding Combat Stats underneath without repeated attribute headings, a red Reset Stats control below, and an interactive circular Build Tendencies graph. The graph uses real Core Stats normalized to the highest attribute; its stat-style reading popup explains the category mapping and scope. It changes no combat formula. Responsive layouts preserve all thirteen combat values.

Loadout opens directly to Nexus; persistent Nexus/Items buttons match the Battle Hall switch and replace the selection cards/back links. Haven’s three duplicate shortcut cards are removed. Training shows one centered Plan, Current Training or Report panel. Cancelling preserves the existing proportional report/reward behavior, settles through the existing idempotent claim endpoint and returns to Plan; a failed settlement retains the Report for retry. Natural completion requires the usual report claim.

PVP Direct uses Small (9×7), Medium (12×7), Large (15×7), matching authored AI arenas, with server settings validation and immutable existing battle snapshots. Its VS centerpiece is visually reworked with reduced-motion support. Global top headers are standardized across public, authenticated, character roster/create and battle shells; Character Select fits ordinary and short desktop viewports without scrolling. All requested follow-ups inherit the existing merge/deploy authorization and require relevant regression/SQL/browser checks.

Guided Fundamentals uses a 9×7 battlefield for new sessions, and its setup label reflects that geometry. Existing stored battle snapshots retain their committed maps.

Guided Fundamentals retains its Guard lesson when slot 3 contains Recovery: a compact exercise-only Practice Guard control arms the existing authoritative Guard preview/commit path. The saved Support Action remains in slot 3, including when MP is already full. Normal battles and combat costs/legality are unchanged.
