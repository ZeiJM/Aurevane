# Automatic actions around a committed combat command

## Authority and scope

This resolves the concrete Task2 ordering question at tested product checkpoint `21130eccddb05c4aee5e7876826b47d8bfe95bc4`. The Owner approved this bounded Extra High pass on10 October2026 at14:25:57 America/Port_of_Spain. Existing implementation/release authorization persists. After this specification, plan and recoverable checkpoint are finished, root must pause for the Owner to switch back to High before product implementation resumes.

This is a future implementation contract, not a completed runtime or acceptance claim. Task1 remains accepted; Task2 remains incomplete. Its independent combined review still covers original BASE `3d9304eef498f32dafd6fe1447cbe3a3fa089faa` through the final Task2 product head, including earlier checkpoints. The main recovery design, exact Owner brief, Global Constraints, Rulings1–12, Manual command specification and elemental policy2 remain binding. This contract clarifies that specification's before-action hook and child Requirements contexts.

The existing version1 native pipeline documented in `docs/COMBAT.md` retains its stage order, hit/damage formula, native Absorb/Reflect sequence and seeded RNG. Ability orchestration surrounds that executor; it does not create a second executor or rename its pipeline stages. A present canonical capture or relevant active Automatic action can require orchestration around a native root even when no modifiers are selected. With absent canonical captures and no attachments, the historical path remains exact.

## 1. Commitment and phase order

One committed root follows this order:

1. Prepare root and explicit Manual modifiers from immutable pre-payment state **S0**. Determine optional qualifying before-action Automatic modifiers from the same S0 and unmodified root facts. Validate the full explicit bundle and quote aggregate payment, clocks, limits and shared guard. Preparation/preview has no effects.
2. Commit the admitted bundle atomically **S0 → S1**: pay once, start shared cooldown keys once, consume admitted usage/guard reservations, advance command sequence and record the existing root Manual activity/participation at its adapter boundary. Lock exact definitions, packet gates/timing, root selection and contribution set. Emit one ordinary root `combat_action_used` attempt receipt at this point.
3. Capture actual payment mutations and update condition memory. Queue their outcome impulses for the outcome seam; they are not hostile damage. Dispatch standalone `combat_action_used/before` Automatic actions immediately against immutable **S1**, before root accuracy/effects. Recursively settle each child through this same command/native executor before the next candidate.
4. Recheck live execution capability for the committed root's original actor and explicit selection. Either settle normally through native accuracy/effects, or settle the paid interruption described below. Do not prepare the bundle or pay again.
5. Capture mutation frames during actual native settlement. Native Absorb/Reflect complete in their existing order. At the existing committed-reaction seam, dispatch queued outcome impulses in mutation order before terminal verdict. A child's frames settle depth first before the next parent impulse. No new Automatic interleaving between native payload packets is introduced.
6. Capture `combat_action_used/after` when this committed attempt finishes, including an interrupted attempt. Dispatch it after earlier outcome frames, subject to current live source/actor/battle admission. Final consequences, terminal checks and native metadata retain their established boundaries.

“Before” therefore means **after commitment/payment, before resolution** for a standalone Automatic action. It is not the S0 context used to qualify a modifier. No before hook occurs for illegal input, a preview, free Controlled prime or already prepaid pending continuation. No modifier is attached a second time by event traversal. A before child cannot add new participants to the already committed parent.

Automatic children never inherit explicit Manual modifier references. They prepare their own unmodified root and supported optional Automatic modifiers. Their behavior trigger Requirements see the parent's immutable event frame; their own costs, availability, cooldown, usage and liveness are checked against the current live state. Their effect gates use the child's own pre-payment owner/selected/affected snapshots plus genuinely available parent triggering/event facts. Parent context must not overwrite the child's owner/resources.

## 2. Live recheck and paid interruption

Before payment, any invalid explicit root/modifier/selection rejects the whole request with zero spend, sequence, usage, cooldown, activity, hook or RNG. After commitment, a before reaction cannot refund, rewind or silently substitute the root.

The recheck verifies: battle still active; original actor living; original Manual turn remains the same when applicable; and the original explicit selection still satisfies current target relation, visibility, range, LoS, elevation, occupancy and native effect capability. Recompute live area recipients from the actual actor placement. A moved original target that is still legal remains that target. Missing/dead/hidden/now-illegal primary selection interrupts; never select a replacement or execute only an arbitrary partial explicit selection.

Do not recheck locked costs, just-started cooldowns, consumed limits, authored activation Requirements or captured-definition/source availability as a new admission. Removal of a source after commitment prevents future activations/maintenance, but cannot change this committed root's captured packets. Its active actor/lifecycle and native settlement gates still apply.

A paid interruption retains aggregate root/modifier costs, clocks, usage, Manual participation/sequence and every completed child result. It emits one new typed outcome:

```ts
{ event: 'combat_action_interrupted'; actionId: string; actorId: string;
  reason: 'actor-unavailable' | 'battle-ended' | 'turn-changed' | 'selection-invalid' }
```

The parent has its single committed attempt receipt and interruption outcome; it has no fabricated hit/miss/critical/resistance receipt, root hit draw, enemy/ground packet, ground area or hit-dependent pending work. A child may consume RNG; that RNG is not rolled back. `combat_action_used/after` describes a finished committed attempt, not proof of a hit. Positive-loss reactions require the actual `damage_applied/after` frame with its real amount/source/target; a miss, zero loss or HP payment cannot masquerade as that frame.

Independent actor-recipient packets retain their native legal-commit/miss behavior **after the before children**, in authored order, if the original actor remains living, the battle active and its required Manual turn unchanged. Fire's caster Chilled cleanse is the required example. Invoke the existing effect resolver through a narrow engine-only actor-settlement entry point with original action/ordinals/origins/gates/timing, no primary/affected/tile targets, and only actor packets enabled. Hit-dependent actor effects such as Blindside remain gated by actual confirmed hostile loss and cannot fire on interruption. Actor-only live capability/predicate checks still apply; an interrupted root is not permission to execute an otherwise illegal actor packet. Genuine actor-only delayed packets retain their captured timing. Stop later packets if this settlement defeats the actor. Preserve native commit-side actor consequences according to their existing predicates; do not manufacture positive-damage eligibility for reveal/backlash/companions. Terminal/wrong-turn/dead actor skips this actor settlement entirely.

Keep the native attempt-side actor consequences in one shared helper so normal and interrupted paths apply them once. Do not implement interruption by fabricating a Self action, renumbering packets, exporting an unrestricted raw executor, or running ordinary whole-action execution with a fake target.

## 3. Event frames, truth and dispatch

Use detached immutable snapshots captured at **each real mutation**, not reconstructed from a command's final state or aggregate event list. A private transient frame records stable authoritative identity, the ordered actual event type/phase receipts associated with that mutation (possibly none), command/root facts, exact before/after requirement subjects and placements, changed resource IDs, causal role IDs and mutation ordinal. One atomic aggregate payment is one mutation frame even if it emits AP/MP/HP receipts. Evaluate event witnesses against each real receipt context, union eligibility with crossing/state entry, and deduplicate once per source/behavior/mutation; do not invent a context in which unrelated receipts simultaneously satisfy All. A private mutation without an authored event still updates state/crossing memory; it is not a fabricated public event alias.

Event identity derives from authoritative root command/chain, nested command identity, mutation ordinal and phase. Client input supplies neither identity, authority, frame nor guard. No full state/frame/session is persisted as an event log. Public ordinary event receipts remain separate from private frames. The transient session shares the existing depth8/budget32 guard and duplicate set across parent, children, native Reflect, packet/boundary frames and source maintenance. Keep outcome queues scoped to their committed command: a child drains its own queue, while parent payment/payload frames wait for the parent seam. A child seam must not accidentally drain the parent queue. Consume the child's returned `resolution.triggerGuard`; do not restart a guard for each frame. Stable candidate order is exact source-instance ID then behavior ID using code-unit comparison.

For a behavior's full All/Any Requirements tree, distinguish three values:

| Value | Meaning |
| --- | --- |
| `holds` | Ordinary immutable-frame truth. Action facts may act as gates on another actual event. |
| `eventMatched` | A satisfying witness contains a matching event/crossing pulse. Any needs a true pulsing child; All needs all children true and at least one pulsing child. |
| `stateTruth` | Evaluate the complete tree with event, crossing and action leaves false. Owner resource/status/prime leaves retain state truth. |

An action leaf holds on actual intrinsic root facts but pulses only on `combat_action_used/after`. Thus `All(action, event before)` may react before; `Any(action, event before)` deliberately may react before and after. A matching crossing leaf pulses only on that real resource mutation and uses its exact previous/current/max values, with existing integer threshold math. Add a typed mutation context so crossing is not inferred merely from arbitrary snapshots; ordinary preview/activation checks cannot synthesize a crossing.

A state-only branch triggers only on `stateTruth: false → true` at an actual mutation. A held low-HP branch inside Any does not fire on every unrelated event. An independently matching event branch can still trigger while that state branch remains true, subject to limits. Union event/state eligibility and deduplicate to at most one activation candidate per source/behavior/frame. Update truth at mutation capture, not later when an old queued frame dispatches; dispatch must never roll memory backward.

State-only branches may use the source owner. Selected/affected/triggering state leaves require a real event anchor that provides those subjects; reject an unanchored nonowner state branch at capability validation. Absent roles cannot satisfy predicates. Only changed resource subjects receive previous-resource snapshots; do not invent resource crossings for unchanged owners. HP cost mutations can cause a resource crossing/state transition but never a damage event.

Extend optional private schema1 runtime state with:

```ts
conditionTruth?: readonly {
  readonly sourceInstanceId: string
  readonly behaviorId: string
  readonly holds: boolean
}[]
```

Each key must be a unique known captured Automatic action behavior, with strict exact strings/booleans and inventory-derived bounds. Preserve usage and condition archive when a source is removed; removing/readding the same source ID, serializing/restoring or refreshing a reader cannot reset limits/truth. Fresh server-authorized source activation may evaluate initial truth once as a real transition. Restored snapshots missing optional truth seed current truth silently; they grant no free activation. Null Requirements project true: they permit one initial real source-activation impulse, not an activation on every event/read; subsequent impulses require a real satisfying event/crossing/state entry. Inactive/dead/terminal sources do not activate. Reconcile truth after real payments, packet mutations, expiry, prime/source changes and children. Pure reads/preview do not reconcile with side effects.

### Supported phase catalogue

The capability catalogue is explicit and backed by actual handlers; structural Requirements grammar remains generic. Initial Automatic action support is:

| Actual event | Supported phase | Required capture point |
| --- | --- | --- |
| `combat_action_used` | before, after | Paid pre-resolution S1; finished committed attempt |
| `combat_action_interrupted` | after | Typed interrupted settlement |
| `damage_applied`, `healing_applied`, `resource_changed` | after | Actual committed recipient resource mutation |
| `ap_spent`, `mp_spent`, `hp_spent` | after | Atomic expenditure mutation, with exact recipient pools |
| `status_applied`, `status_removed`, `status_expired`, `persistent_effect_applied` | after | Actual apply/remove/expiry/persistent mutation |
| `barrier_changed`, `barrier_absorbed` | after | Actual barrier mutation |
| `combatant_displaced`, `combatant_rewound` | after | Actual placement mutation |
| `movement_spent`, `action_spent` | after | Real expenditure/activity mutation |
| `battle_started`, `round_started`, `turn_started`, `turn_ended` | after | Prepared live lifecycle boundary |

No before phase exists for an already committed HP loss, status mutation or boundary. Reject unknown/unimplemented events and unsupported phases with named capability errors at definition admission/runtime and publication; never accept a listed event without its actual mutation handler. Hit/accuracy/resistance/private diagnostic receipts are not newly available authored events. Prime-specific event names become available only with Task4's real typed implementation; state-only prime truth can then follow actual persisted prime mutations.

Outcome impulses queue in actual mutation order and settle at the native committed-reaction seam **after native Absorb/Reflect, before terminal checks**. They can evaluate an earlier crossing accurately even if later packets change HP again, while each child still admits against live current state. Payment impulses precede later packet impulses in that queue; before-use reactions run immediately at their separate hook. Do not move native Reflect after those children or interleave new children between native damage packets.

## 4. Explicit Automatic target binding

Task1's targeting geometry does not identify whose unit an Automatic action selects. Extend the canonical behavior narrowly:

```ts
type AutomaticAbilityTargetSubject = 'owner' | 'triggering' | 'selected' | 'affected'
// On AbilityBehavior, only activation:automatic + mode:action:
automaticTarget?: { readonly subject: AutomaticAbilityTargetSubject }
```

Self actions implicitly select their owner and may omit this field; if present on Self it must be owner. Ordinary unit-targeted Automatic actions require an explicit binding. Caster-centered Circle/All/no-selection geometry uses its native owner/footprint and rejects inapplicable binding fields. Manual, modifier and Ongoing behaviors reject the field. Strict parser rejects unknown keys/subjects; captured definitions, exact-version reads, publication and authoring must preserve it.

| Role | Authoritative ID(s) |
| --- | --- |
| owner | Owner of this captured Automatic source |
| triggering | Actor/source that caused the frame; root actor for use, damage source for damage, incoming actor for turn start |
| selected | Original real primary selection of the triggering command, when available |
| affected | Actual mutation recipient; ordered actual affected set for a command-use frame |

For payment, affected is the paid actor; for expiry there need not be a triggering source. Never infer a triggering enemy from “the other team.” Binding reads immutable role IDs and resolves their current live placements through native relation/range/LoS/elevation/visibility admission. Missing role, unavailable unit or incompatible targeting suppresses that child with **zero** spend/usage/cooldown. No heal/counterattack inference, nearest/first-unit fallback, stale position or partial arbitrary group.

Task2 implements supported Self/single-unit binding and fail-closed capability errors for unavailable selection forms. Task3 owns the real plural/Line/Circle/All/Ground extension through the same field/role contract. Plural affected selection obeys authored cap and exact full-set legality; until represented it is specifically unsupported. Directional targeting cannot invent a direction from a nonaligned role. Caster-centered area activation uses the Automatic owner, not the triggering actor. No new geometry is claimed delivered here.

## 5. Native adapters, pending work and boundaries

Canonical roots, captured Resonance V1/V2, Mature/Essence, native Basic/auxiliary roots, AI and actual PvE/PvP services must enter the common orchestration when relevant captured Automatic sources exist, including enemy-owned before reactions. Do not test only a direct helper while the real caller bypasses it. Preserve the private trusted Basic marker/Ruling11 even for a zero-attachment native Basic root that now needs event traversal; its seeded hit/critical/formula and receipt shape remain native.

Conditional affected-unit packet gates are captured for the pre-payment subject universe, then intersected with actual legal live geometry at settlement. Ungated packets retain native behavior. A newly created subject lacking an activation snapshot cannot pass a conditional gate. Pending captures freeze the actual scheduled recipient/gate/timing/source version; delayed settlement neither regates nor pays/reemits parent use. Capture real pending/DoT/Ground mutation frames, without pretending they are a new Manual action.

At a real incoming turn, resolve prepaid pending/boundary work, reset incoming AP, tick old cooldowns and advance actual source-owner/round epochs before incoming Automatic boundary actions. Reuse an idempotent prepared-turn marker. A5AP incoming Automatic therefore leaves95AP and its new cooldown intact; later adapter preparation cannot reset either. It can run when prior-turn AP was0, does not mark participant activity and does not fabricate an extra turn/reward. Terminal/prepaid defeat prevents incoming activation. Capture frames at actual mutations and drain in the established boundary sequence; do not reconstruct from final AP100.

Ongoing stays source-owned maintenance. Unsupported continuous packets remain explicit errors. All accepted source/behavior captures are immutable across content edits/reconnect. Current service authority, version/fingerprint/idempotency CAS persists one whole returned root+children transition; replay cannot execute children again. A changed explicit modifier bundle changes the command fingerprint.

## 6. Controlled, Move and presentation handoffs

Task4 free whole-Manual prime emits no action-use hook/payment/activity. Legal release consumes its persisted prime and locks original anchor/bundle at commitment **before before-use reactions**. A paid interrupted release retains costs and does not restore its prime; invalid pre-commit release retains it. Prime mutation truth and any future typed event do not make priming itself a paid root. The Owner's latest UI remains binding: no primed decoration/extra Release button; only legally ready light within the existing skill image, with native input, accessibility and reduced-motion treatment.

Task3A Move is first/once Manual walking. It uses actual reached origin, step costs and interruption rules; do not compose or pay again after movement, reinterpret this hook as a second move command, or expand Automatic Move. Task3/3A must carry locked eligibility and original-selection semantics through actual movement/geometry.

Preview is pure: no child simulation, RNG, truth/guard/prime/sequence mutation or hidden-source forecast. It can show admitted root/modifier costs and current assuming-hit forecast with truthful conditional outcome language. Existing ten ordered public reader rows remain; targeting/event explanation belongs in their appropriate rows, not new cockpit slots.

All frames, runtime truth, guards, committed admission, private suppression, accuracy, Requirements and raw source/version provenance remain private. Actual preview/live/history DTOs must strip them before service integration. The new public interruption mapper exposes only the minimal typed action/actor/reason allowed by existing visibility policy; Chronicle must never name a hidden reactor or claim a hit/miss.

## 7. Bounded implementation structure

Add `combat-ability-events.ts` for the explicit phase catalogue, immutable frames, pure selection binding and shared dispatcher/session. The dispatcher accepts an injected Automatic-command executor; it must not value-import the command module or implement hit/damage itself. Keep Requirements witness/projection evaluation in `combat-requirements.ts`, strict target/schema capability in `combat-definition.ts`, condition persistence in `combat-behavior-runtime.ts`, and native mutation capture/actor-only settlement at existing action/boundary helpers.

The committed execution context is engine-issued and transient, bound to exact actor/action/root/turn/selection/provenance. A module-private issuance check rejects fabricated or mismatched contexts. It permits locked payment/activation admission to be reused while current geometry/effect capability is checked. Do not add an authored/client boolean that bypasses legality, serialize this context, or spread it through public DTOs.

No unrelated rewrite, roster publication, hosted mutation or partial release belongs in this pass. Complete original Task2 integration and independent gate still precede dependent tasks. The separate implementation plan assigns meaningful red/green coverage and real producer/service proofs.
