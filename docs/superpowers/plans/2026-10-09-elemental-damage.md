# Elemental damage implementation plan

Spec: 2026-10-09-elemental-damage-spec.md.

Execution: one cohesive implementation task, followed by a fresh task review and combined release review; root coordinates the already implemented earlier fixes. Repository already isolated on agent/summon-compact-chronicle-20261009. The Owner's standing automatic approval covers routine work and release.

Global constraints: use shared server-authoritative rules, validated immutable content, optional encounter policies preserving historical absence, no client combat authority, no hidden-state leaks, no unrelated dependencies/SMTP/deployment settings. Preserve the prior Oct9 fixes and costs/powers/geometry except explicitly broadened Fire targeting.

### Task 1: Implement the elemental contract end to end

Read the adjacent spec verbatim. Trace existing elements/status application, terrain overlays/persistent Ground, initiative order/round wrap, final-facing and Master publication before editing. Write practical focused failures and observe RED before each behavior change. Implement shared helpers where useful, route current encounter factories/readers/AI through the same authority, append immutable roster versions, expose captured bonus inputs, and add gentle mist animation with reduced-motion parity. Run targeted tests, types, actual browser coverage as appropriate; inspect the diff for regressions. Record exact commands/results and uncertainties in task-1-report.md. Do not claim deployed.

Interfaces: produces optional elemental/dynamic-order policies, captured elemental tuning, derived status/Initiative behavior, Fire dual intent, typed Ice roster and reader/editor representations. Consumed by existing battle services, snapshots, AI, readers, Master publication and board presentation. Shared earlier code includes current airborneJumpPolicyVersion1 and same-level plateau exit; never restore saved-profile mutation or occupied-only Skill glows.

Expected: new focused tests fail before implementation and pass afterward; all prior tests remain green unless a current presentation expectation is intentionally superseded with historical behavior covered. No persistent character-stat mutation; exactly one living actor turn per round despite reorder. Final root full check and exact-head CI must pass before merge/deploy.

### Task 2: Review and release the combined verified source

Fresh reviewer receives spec, report and complete diff; resolve material defects with scoped RED→GREEN fixes and review. Root verifies browser parity, pnpm check, fresh main, exact-head CI and merged tree, then deploys the authorized merged SHA, verifies canonical alias/routes/runtime and supplies an Owner test list. Update release receipts accurately.
