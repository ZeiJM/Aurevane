# Move / editable Basics historical start boundary — October 14

Historical start receipt, superseded by `2026-10-14-move-command-included-cost.md` for the current implementation and Owner cost correction.

No Move product code has been written at this boundary. The next task is3A of
the approved unified-engine recovery plan. Coding is paused for the Owner's
requested Extra High switch for one bounded integration design pass.

## Accepted source and saved work

Targeting source1b3152144e025ebd38139b1c84a6d0544e3f8f7b,
tree4e5a5a45c2ff6a91ddfee52d956c4e289ecffd32, is saved in draftPR899.
All six latest scoped workflows pass except the broader Browser smoke still
running; its focused current/historical geometry and canonical14 matrix pass.
Local core3006/155, web2443/293, DB94/15 and Node7/7 pass. The bounded independent
review's Important findings have valid-definition RED/GREEN fixes; no additional
rereview loop is needed for those fixes. Final overhaul integration/release
acceptance remains pending. No new production mutation or deployment occurred.

Account portrait relocation is saved independently in draftPR902:
9931761fab97fce2accaa5379d0ca56dc2b00d49,
treea19b8c2044a3fc230062b8b311d073a57e19de62. Existing menu/shell checks
reproduced RED2/6 and pass6/6; full web2443/293, types/lint/format and CI pass.
Native desktop/mobile placement and wider layout checks are running. Preserve
this separate branch and its saved custom-image/right-corner checks.

## Actual integration seams

- The effect registry is combat-tag-registry.ts; there is no separate
  combat-effect-registry module. CombatTagPayload has no Move payload yet.
- combat-behavior-runtime.ts materializes native packets using
  nativeCombatTagPayload. Move needs real routing and compatibility support,
  rather than a prose tag or an unsupported native packet.
- evaluatePv1fMovement / executePv1fMovement in pv1f-action-economy.ts own
  orthogonal entered-tile legality, terrain, occupancy, Root/Haste/Slow,
  Jump/Airborne, remaining Movement, Poison step effects and native observations.
  Reuse their authority; do not create a parallel walking executor.
- combat-ability-command.ts locks and pays the participant bundle, dispatches
  before-use reactions, then rechecks live original actor/selection before
  settlement or paid interruption. Preserve those boundaries and immutable S0
  modifier/effect-gate inputs; do not recompose or repay after walking.
- CombatTargetSelection/request validation currently has no Move path metadata.
  The exact reference-only path/follow-up representation is still a design
  decision. Quotes must account for movement while execution must use the
  actually reached origin; a planned endpoint cannot become an attack origin
  after interruption. A defeated actor must perform no follow-up.
- Current Owner correction: attached Move is included in the overall authored
  Skill cost, without additional walking AP. Cap1–20 plus remaining Movement
  remains. Standalone native walking retains its own historical price. Preserve
  valid Poison-interrupted walking and original native clock/events.
- Move is once, first, Manual walking only. Automatic/Ongoing Move and human
  summon Move commands remain unsupported unless a real later extension lands.
- Basic Move's zero-authored-AP offensive use is bounded once per acting turn,
  including misses; invalid/free prime do not consume it. Positive-AP and pure
  walking preserve their ordinary limits.
- Basic Attack remains stat-derived using committed Physical/Mystic family
  (Physical ties), with positive authored AP. unarmed.basic content identity is
  distinct from command identity. Read the actual Basic Move command identity.
- Include every SUPPORT_ACTION_IDS definition: basic.guard, basic.recover,
  basic.recover.mp. All are independently editable/captured/versioned; the one
  equipped support slot and four Discipline slots remain. Follow the auxiliary
  editor addendum and preserve existing cooldown/conversion semantics.

Read the actual3A brief, shared committed-order and Manual modifier specification,
and applicable AGENTS/Combat authority before tests or implementation. The
existing isolated Move branch starts from the accepted targeting source. Return
to High once the integration contracts are fixed and verified. This boundary
does not claim Move/Basics, Controlled, Master revamps, weather/day-night,
map loading or final creative balance is implemented.

