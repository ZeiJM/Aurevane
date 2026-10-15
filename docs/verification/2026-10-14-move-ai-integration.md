# Move-tagged AI commands — October 14

Task3A draft continuation; no release or full-task completion claim.

## Delivered behavior

Build-aware Recruit AI plans one shortest legal walking route per destination through the same stat-driven walking evaluator used by commands. Routes are bounded by authored entered-tile cap, remaining Movement, terrain, occupancy, Jump, Root and the existing AI profile candidate limit. Attached Move has no walking AP affordability filter: a 100 AP Skill can spend its full price and still move. Only the canonical command validates and pays the authored resource bundle.

Each route preserves the original unit/Ground/area selection; plural candidate composition stays within a single route. Unconditional Move geometry is pruned through the shared targeting resolver at the planned destination. Conditional effect eligibility remains an S0 command decision, including legal stationary follow-ups when Move is ineligible and walking is exhausted. Conditional unused-path candidates do not mark an illegal tile visited; later legal climbing routes remain discoverable.

Captured Manual Basic actions join actual AI selection. Basic Attack retains its real command identity, while native per-terrain Basic Move remains on its walking facade. Flat Basic Move uses the captured action facade and its saved authored payment. Selected paths and behavior IDs are copied into AI intent and forwarded through actual server execution; immutable Basic captures participate in the existing private build-aware inventory, without current publication reads or extra Support slots.

Existing approach planning now excludes tiles blocked for the actor before temporarily projecting a planning origin onto them. This prevents an invalid fake placement from aborting otherwise legal path search.

## Regression evidence

- Skill, Essence, Resonance and flat Basic Move previously returned ordinary movement or threw the flat facade error instead of choosing the legal combined action. Ground follow-up likewise lacked its path. Valid failing tests reproduced these omissions before implementation.
- Core tests verify two entered tiles, preserved targets, exactly one action receipt, 100 AP and 2 MP payment without surcharge, no planning mutation, and rejection of occupancy, Movement, Jump and unaffordable commands.
- Additional cases cover ineligible conditional Move with exhausted walking, flat versus per-terrain standalone routing/payment, and a legal climbing route to a tile illegal as the first step. The latter exposed the blocked planning-origin exception, then the incorrectly visited conditional tile, before the respective corrections.
- Real server regressions reproduced a dropped Move path and excluded Basic inventory. After forwarding/admission corrections, all35 AI service cases pass; current/pinned mutable resolver reads remain forbidden, first CAS contains the intended combined action, reached placement and one authored AP payment, and the response excludes private execution records.
- Final focused core suites70/3 pass. Invalid fixture movement accounting and terrain ordering were corrected before counting the valid regression failures.

## Verification and release boundary

Format, lint, all eight package type checks and a forced uncached production build pass. All complete package suites were verified directly: core3,057/158, web2,491/295, DB96/15, validation92/9, audio17/3, realtime3/1 and worker2/1 (5,758 Vitest tests), plus seven Node checks. The combined scheduled test log did not show complete execution and was not counted as whole-suite evidence; direct complete suite results replace it. Current main remains064389db at the final freshness check; no reconciliation is required. The preceding durable JSONB restore head9cb32327 passes CI, seven supporting workflows, UI layout and Living Atlas; broader Browser smoke remains running at this check. Representative Buildcraft now passes23 cases with6 skipped; its remaining failure is a Mastery flow attempting unequipped HP Recovery after Guard was captured. No stored-battle persistence errors occur in that workflow. The controls/availability and native fixture setup must be updated coherently with the approved single Support slot; accepting an unequipped action would violate that contract.

Move controller/path UX and flat native intent routing, complete captured Basic displays and enabled-state presentation, Master editors/previews, Controlled readiness and the creative balanced all-tag roster remain outstanding. No production deployment, hosted mutation or schema change.
