# Explicit modifiers on one authoritative combat command

## Purpose and authority

This is a narrow architecture clarification inside approved recovery Task2, not a new game subsystem or another product approval gate. The Owner confirmed Extra High for this pass on10 October2026 and requires a pause to switch back to High afterward. Existing implementation and final-release approvals persist. Task1 remains accepted; Task2 remains incomplete and independently unaccepted. This document specifies future implementation, not delivered mechanics.

Manual means an explicit legal player/AI command. A Manual modifier is selected **for a particular Manual root action in that command**. It is neither an independently cast action nor an automatically attached passive. Automatic modifiers attach only through the supported before-action hook; Ongoing remains source-owned maintenance. A mixed source can contain all three without changing their activation semantics.

We use an explicit per-command selection because it matches the existing action/preview/version/idempotency flow. A persistent “armed modifier” queue would introduce another expiring state and interfere with Controlled; implicit attachment would violate Manual. Neither is introduced.

The main recovery design, exact Owner brief, nine prior rulings, elemental policy2, immutable historical definitions, global constraints and the original full Task2 BASE remain binding. Root writes this clarification and its continuation plan; the High implementer produces and tests product code, and the eventual independent Task2 gate reviews all task commits.

## 1. Intent and admission

Add the same optional fields to the existing strict `kind: 'action'` intent used by preview and commit:

```ts
interface ManualCombatModifierSelection {
  readonly sourceInstanceId: string
  readonly behaviorId: string
}
// Existing actionId and target remain.
// behaviorId?: string selects a root Manual action behavior.
// manualModifiers?: readonly ManualCombatModifierSelection[]
```

References contain identities only. They contain no definitions, costs, versions, target overrides, execution authority, guards or event context. Resolve each against the encounter's exact private captured sources and authoritative active-source set for the acting owner. Source IDs use the capture module's nonempty, exact, no-outer-whitespace identity semantics; behavior IDs must match an existing stable ID. Do not trim/rewrite opaque JSON source IDs. Unknown reference fields, nonarrays, malformed strings and duplicate `(sourceInstanceId,behaviorId)` references reject the request. Distinct modifier behaviors from one captured source are allowed.

Omitted or empty `manualModifiers` means no Manual attachments. There is no default attachment and no silent fallback if a supplied reference is invalid. Root `behaviorId` may be omitted only when the selected source has exactly one Manual action; ambiguity remains `ambiguous-manual-behavior`. A modifier cannot be invoked by itself as the root. Explicit references must resolve to `activation:manual, mode:modifier`, a living active source owned by the actor, and the supported compatibility described below. Foreign, inactive, stale-version and disabled/admission-invalid sources fail closed. A definition update outside the battle cannot replace its captured version.

Only the action intent accepts these fields. Move-only, face, end-turn and other strict intents reject them. Manual attachments are not carried into a later Automatic action/reaction. AI can choose a Manual bundle on its own legal controlled turn using the same admission; no human command authority is granted to summons.

Use the existing definition budget as the command composition budget: **at most16 contributing behaviors including the root**, at most32 authored effects per behavior, and thus at most512 authored effects/contributions in total. The explicit Manual list therefore has at most15 entries. Automatic attachments share the remaining participant capacity and the existing depth8/reaction-budget32 guard. These are safety bounds, not a roster balance budget. Do not silently truncate explicit Manual selections; return `modifier-command-budget`. Deterministically suppress over-budget optional Automatic candidates without paying or reserving them.

## 2. One preparation path for canonical and native roots

Produce one private, pure `prepareCombatAbilityCommand(input: CombatAbilityCommandInput): PreparedCombatAbilityCommand` consumed by both evaluation and commitment. It returns the exact fully composed native action, legal evaluation, aggregate costs and source-attributed contributions. Preview must forecast **that action**, not a separately rematerialized basic action. Preparation must not mutate state, consume RNG, advance command sequence, reserve a cooldown or spend a guard.

`CombatAbilityCommandInput` carries existing state/actor/selection/content/context plus a trusted `root`, optional Manual reference list and optional internal Automatic trigger. Its root is a discriminated union:

- `kind:canonical`: captured source and optional behaviorId; classification, costs, cooldown, effects and intrinsic Discipline derive from the selected captured behavior/source.
- `kind:native`: existing trusted native action, typed authoritative AP/MP/HP cost quote, classification/family/intrinsic source and provenance derived by an existing legacy/Basic adapter. This is server/core input, never accepted from a client. Keep native action consumption and existing legality/history policies at their current adapter boundary.

The shared public-to-core reference type above is exact; the private core orchestration contract uses these field names:

```ts
type CombatAbilityCommandRoot =
  | { readonly kind: 'canonical'; readonly source: CapturedCombatAbilitySource;
      readonly behaviorId?: string }
  | { readonly kind: 'native'; readonly action: CombatActionDefinition;
      readonly sourceInstanceId: string; readonly costs: AbilityBehavior['costs'];
      readonly classification: AbilityClassification;
      readonly attackFamily?: AbilityAttackFamily; readonly sourceDisciplineId?: string }
interface CombatAbilityCommandInput {
  readonly state: CombatEncounterState
  readonly actorId: string
  readonly root: CombatAbilityCommandRoot
  readonly selection: CombatTargetSelection
  readonly content: CombatContentCatalog
  readonly context: CombatResolutionContext
  readonly trigger?: CombatAbilityActivationInput['trigger']
  readonly manualModifiers?: readonly ManualCombatModifierSelection[]
}
interface PreparedCombatAbilityParticipant {
  readonly sourceInstanceId: string
  readonly abilityId: string
  readonly contentVersion: number
  readonly behaviorId?: string // absent for a historical native root
  readonly activation: 'manual' | 'automatic'
  readonly mode: 'action' | 'modifier'
  readonly costs: AbilityBehavior['costs']
  readonly cooldown: SkillCooldownDefinition | null
}
interface PreparedCombatAbilityCommand {
  readonly action: CombatActionDefinition
  readonly evaluation: CombatActionEvaluation
  readonly costs: AbilityBehavior['costs']
  readonly participants: readonly PreparedCombatAbilityParticipant[]
  readonly context: CombatResolutionContext
  readonly requirementSubjects: readonly {
    readonly combatantId: string; readonly subject: AbilityRequirementSubjectState
  }[]
}
interface CombatCommandDamageBonus {
  readonly sourceInstanceId: string
  readonly contentId: string
  readonly contentVersion: number
  readonly behaviorId: string
  readonly effectId: string
  readonly multiplierBasisPoints: number
}
```

Native root tags/content/version/source kind/owner derive from its trusted action and context provenance, not duplicate client fields. Native roots are initially Manual; canonical Automatic roots require the internal trigger authority. Array-based requirement subjects avoid special-object-key ambiguity. Extra private preparation diagnostics/reservations may remain internal to the module; do not change the consumed fields silently. `commandDamageBonuses?: readonly CombatCommandDamageBonus[]` is the native action and applicable captured pending metadata field. Entries exist only after their immutable effect gate passes; no caller supplies one through battle intent.

`PreparedCombatAbilityCommand` exposes private readonly `action`, `evaluation`, `costs`, `participants`, root `context`, and immutable requirement/packet metadata needed by the commit. Each participant records exact source/version/behavior identity, activation, costs, cooldown and usage/guard reservation. Native roots without canonical usage rules do not acquire invented canonical limits. Prepared data is internal and transient; it is not a client token or a persisted replacement for captures.

`commitCombatAbilityCommand(input:CombatAbilityCommandInput):CombatResolutionTransition` prepares afresh against its authoritative state and commits the resulting participants/action once. Keep `evaluateCombatAbility(input):CombatActionEvaluation` and `activateCombatAbility(input):CombatResolutionTransition` as canonical facades over preparation/commit, with optional reference selections on their input. Existing native/PV1F/Mature/Essence/Resonance adapters derive trusted roots and delegate when a canonical source or attachments need the command path. With absent canonical captures and no attachments, preserve the historical path exactly. Native Basic Attack and legacy Skill roots can be modified without reauthoring or converting their saved definitions; preserve their existing stat-derived power, AP/MP quotation, attack family and historical scaling before composing additional packets.

Do not create a second hit/damage executor. The prepared native action reaches existing `evaluateCombatAction`/`executeCombatAction`, native policies, stat scaling, pending settlement and reaction helpers. Do not enter a composed native action back into composition recursively.

## 3. Immutable root facts and Requirements

Compute qualification from the **unmodified** root: its classification, attack family, intrinsic source Discipline and tags. Modifier tags or a chosen earned eligibility Discipline cannot rewrite those facts or cause another modifier to qualify through an accidental cascading match.

The internal modifier context uses `event.type:'combat_action_used', phase:'before'` with those root facts. This names the existing action-use event and adds a supported pre-use hook; it does not claim the action committed before legality/payment. No hook is dispatched on a preview. A commit's hook ID is derived from the authoritative root command and phase, not supplied by the client.

For a Manual root, owner/selected/affected subjects use immutable pre-payment state. There is no triggering subject merely because the user selected a target. An Automatic root validates its own behavior against the parent immutable trigger; its modifiers qualify against that new root's before-action facts, retaining only actually available triggering subject snapshots. Supplying a before-action context never grants Automatic/off-turn authority.

Selected Manual behavior Requirements must hold or the entire command is illegal. Effect Requirements independently gate their packets; an unmet conditional companion must not disable unrelated damage. A legal selection can pay even when all its conditional effects are gated, just as a legal miss pays. Requirements and eligibility never become refunds or per-recipient costs.

Ruling9 remains exact: effect eligibility uses immutable pre-payment subjects and effective timing; pending work retains the activation decision. Native actual hit/resistance/alive/landing/positive-loss checks remain. For future Move, keep pre-payment subject snapshots separate from the geometry resolved from the actual reached origin. Task3A intersects actual legal recipients with eligibility evaluated from those snapshots; it must not use the planned endpoint or re-read post-payment predicates. A newly created/unavailable subject cannot satisfy a predicate whose activation snapshot is unavailable.

## 4. Compatible modifiers and packet formation

Initial packet modifiers are the already authorized Damage/Pierce plus explicit required elemental apply/remove companions. They attach to an **Attack root**, inherit its applicable hostile hit/targeting contract and never introduce independent selection, Range, shape, relation, LoS, elevation or accuracy. Existing Manual `damage-bonus` is supported as a command-scoped outgoing contribution on an Attack root; Ongoing uses its existing maintained path. Automatic `damage-bonus` is not newly enabled by this design.

Retain actual payload recipients (`actor`, `primary-unit`, `affected-units`) under the root resolver. A required primary recipient missing from a compatible root returns `modifier-root-incompatible`; do not choose an arbitrary first target. Actor companions keep their existing independent commit semantics; hit-dependent unit packets use the root's one applicable recipient hit decision. Modifier-specific accuracy remains inapplicable. Pierce affects only explicit equipment Armor under the current boundary, not general mitigation.

Canonical root packet order is unchanged. Append selected Manual modifier blocks sorted by exact source-instance ID then behavior ID using deterministic code-unit comparison; append eligible Automatic blocks in the same stable order. Preserve authored order inside each block. Client reference order does not control hidden effect ordering. Expose this fixed order in preview/reader copy where it changes outcomes. Do not move ordinary packet effects before a Move-first root.

Normalize/materialize the **complete composed action before** preview, hit grouping, elemental intent and native settlement. Preserve each contribution's explicit native scaling/defense family and payload settings; a modifier does not inherit a conflicting root scaling profile. Root legacy power scaling uses its original authored packets/cost, not the composed packet count or aggregate modifier AP. Each appended packet retains private sourceInstanceId, behaviorId, effectId, content identity/version and its own timing/eligibility.

Water/Ice/Storm companions require positive hostile settled HP loss from their own contributing elemental packet group/source/behavior under the existing policy2 association, not another root or modifier's neutral hit. Fire caster-only Chilled cleanse retains its explicit legal-commit behavior, including empty/missed/delayed cases. Source ownership/timing survive absorption, delay, JSON restore and pending resolution. Full composed native validation runs before payment; unsupported Ground, Summon, Move and unrelated packet modifiers reject specifically rather than masquerading as ordinary native packets.

Manual `damage-bonus` is not a timed status, a maintained source or a future “next hit” charge. Capture its exact source-attributed multiplier for this command's direct outgoing damage packets, including those packets' prepaid delayed settlement. It does not amplify unrelated reactions, other actions or already pending work. Add a private `CombatCommandDamageBonus` list to action/captured pending metadata and an optional command-contribution argument at the existing conditional outgoing multiplier boundary. Each entry contains source/version/behavior/effect identity and multiplier; effect eligibility is captured. Combine through the existing integer ratio/rounding/stacking-policy rules with Ongoing/native modifiers; do not introduce an unrelated damage formula. Absence preserves historical behavior. The contribution is discarded after its command/pending packets, and never enters `abilityRuntime.maintained` or active status arrays.

## 5. Automatic attachment without changing Manual semantics

Only active captured modifiers of the root owner may attach. A foreign source's counterattack is an Automatic action with its own trusted owner; it cannot insert outgoing packets into another character's action.

The initial Automatic modifier capability is explicitly **before-action-qualified**. Every possible satisfying branch of its Requirements must contain an action qualifier or `combat_action_used/before` event qualifier. Ordinary state predicates may further gate it. Null/state-only predicates, other-event/after-phase and threshold-crossing modifier contracts reject with `automatic-modifier-before-action-required`; use supported Automatic actions for post-outcome reactions and Ongoing for continuous bonuses. There is no deferred modifier-charge queue.

The structural qualification check is exact: an action predicate or the supported before event is anchored; All is anchored if at least one child is anchored; Any is anchored only if every child is anchored. Reject incompatible event phases/types and threshold-crossing predicates anywhere in an Automatic modifier tree. This is a capability gate, not a second Requirements authoring system.

Determine all candidate predicates from the same immutable activation state before any own costs. Reserve the complete root+explicit Manual costs first. In stable order, admit an eligible Automatic candidate only if root compatibility, its own cooldown/limit/active-source/guard/participant budget and the remaining aggregate resource budget permit it. An unaffordable/ineligible optional Automatic modifier is suppressed with no cost/usage/cooldown; it does not invalidate the explicit root bundle. Record truthful private suppression diagnostics on a committed command, without exposing hidden sources in public forecasts. Explicit Manual selections are never silently dropped.

Each admitted Automatic modifier consumes the shared guard once at commitment. Its before-hook event ID distinguishes duplicate delivery from a subsequent root in the same reaction chain. Authored once-per-action still spans the whole original chain, including recipients/packets/reactions. Preparation only quotes the guard. Final event traversal must not dispatch the same before-action modifier again after payment. Existing state-transition memory semantics for Automatic **actions** remain part of complete Task2 event integration, not replaced by this attachment rule.

## 6. Atomic commitment, clocks and replay

An illegal explicit bundle spends/reserves nothing and does not advance sequence. Aggregate each participant's AP/MP/HP with safe integer checks; check all pools from one state, HP leaving at least1. Native costs are prepaid once. Emit one settled expenditure transition per nonzero resource with source-attributed contribution detail; no observer sees intermediate root-then-modifier pool states. HP expenditure is never damage. Capture before/after subjects for expenditure events at that atomic mutation.

One root consumes ordinary action/participation once at the existing Manual adapter boundary. Attachments do not consume another action. Automatic work never marks Manual activity. All accepted participant usages, guard reservations and cooldown starts belong to the same authoritative command transition. A legal miss/all-gated attempt consumes its accepted costs/limits/cooldowns; illegality/replay does not.

Use authored cooldown keys and existing owner-turn advancement. Check their pre-commit state. Participants intentionally sharing a key can activate together while it is ready; start that key once using the longest authored duration, retaining contributor attribution. Do not let a shorter later packet overwrite a longer cooldown, or introduce accidental source-key namespacing that changes existing shared-key behavior. Root native cooldown is not started a second time: preparation checks participant cooldowns explicitly and returns a prepaid native action with resource amounts zero and handled cooldown omitted; command commit owns all participant starts. Preserve the existing native key/tick conventions.

Manual root chain identity derives from battle/turn/persisted command sequence, incremented exactly once after legal commitment with safe overflow rejection. All participants and child reactions share that root chain; child Automatic work does not advance Manual sequence. A stale internal Manual command context rejects before mutation. Server preview is a quote; commit resolves again against authoritative expected battle version and current captured sources. Persist the state transition through existing CAS/idempotency authority.

The request fingerprint includes normalized root/group, targets/path and sorted Manual reference set. Reusing a committed idempotency key with the same normalized request returns the existing receipt; changing the bundle returns an idempotency conflict, not another execution or a misleading old preview. Inspect real existing persistence contracts before any additive local SQL change; do not assume an in-memory test proves replay safety. No hosted operations in this stage.

## 7. Controller, preview and privacy handoff

In the actual battle controller, arming a Manual root exposes legal owned Manual modifiers as explicit selectable choices; selecting one modifies that pending command only. Show combined AP/MP/HP and participating cooldown/blocked reasons in its ordinary preview. Recompute on target changes, preserve deliberate selections until the root/group changes or the user cancels, and reject an unavailable selection visibly rather than auto-dropping it. Clear attachments on root/group change, cancellation, stale command replacement, turn loss and terminal cleanup. Native keyboard and touch use the same state/intent; no locator-focus shortcut proves accessibility.

Controller data comes from a safe owner-relative availability DTO, not raw captured definitions. It contains only authorized source identity, behavior ID, name/type, costs/cooldown, requirement/effect explanations and eligibility/blocked information. Safe forecast data shows exact public composed effects/costs; internal action, raw accuracy rules, requirement snapshots, private capture/runtime/bonus metadata and hidden-source provenance never leave API/RSC/live/preview boundaries. Task2 must strip its new internals before persistence wiring; Task7 later completes every recursive reader.

Root action targeting rows keep the shared ten-field order. A modifier reader explains “Modifies the selected action” and inherited targeting; it does not suggest a second cast or show fabricated Range/targets. Editor Manual/action versus Manual/modifier follows the registry's supported capability, not a parallel schema. Full polished selectors/readers are delivered through actual dependent controller/presentation tasks; complete Task2 must expose and test the service admission and safe availability needed by them.

## 8. Controlled and Basics downstream

Task4 prime captures the exact root plus chosen Manual modifier references/definitions as one free whole-action bundle. It performs structural/source admission but does not pay ordinary costs, start cooldowns, consume modifier limits or dispatch a before-action modifier hook. Release revalidates current source availability, Requirements, legal current selections and aggregate costs; automatic candidates are chosen at release. Illegal release retains the prime. The Manual attachment set cannot be silently changed during release; ordinary current target selection may change where the root contract permits. Cancellation/source removal/defeat/battle end reconciles the whole captured bundle. Do not invent an additional independent Controlled modifier release or a refund.

Task3A preserves Basic Attack's stat-family/positive-AP publication safety and Basic Move's real entered-step AP/Movement rules. A paid modifier cannot evade the guard on a zero-authored-AP offensive Basic Move follow-up; miss consumes that guard, prime/illegal do not. Pure walking stays ordinary. Modifier packets after movement use actual reached-origin geometry and immutable activation Requirements, never a planned destination. Task3A separately resolves its existing Move-first versus actor-prefix discrepancy; this spec does not authorize a new sequence.

## 9. Required proof and boundaries

The continuation plan pins explicit-only selection, malformed/foreign/inactive/duplicate refs, root group ambiguity, mixed-source fixed order, aggregate resources/nonlethal HP/atomic snapshots, cooldown-key sharing, all limit epochs, miss/no-op/replay, optional Automatic suppression, structural All/Any qualification, exact preview/commit action, elemental contribution ownership/delay, transient Manual bonus, legacy/native roots and recursive privacy. Existing Reflect and incoming AP/cooldown regressions remain mandatory.

Tasks3/3A/4/7/10/13/15/16 receive these interfaces and prove their actual plural geometry, walking, prime/release, controls/readers and final roster cases. Unsupported capability fails with a named reason until its responsible task is implemented. No test-count or architecture-document update can mark Task2 playable/accepted; its complete real service/core gate and independent review are still required.

Self-review: the recommended approach has no persistent arming queue, client execution definitions, automatic Manual attachment, separate damage executor, per-recipient payment, mutable pending predicate, modifier hit roll, planned-endpoint attack, duplicate cooldown start or private DTO leak. Numeric bounds reuse current definition/guard budgets. Root qualification stays intrinsic; actual captures/history and absent-field paths remain authoritative.


## Trusted native Basic Attack adapter clarification — Ruling11

A trusted composed native Basic root may carry private `nativeBasicAttackCommand:true` to enter shared accuracy/critical/packet settlement. The ordinary absent-marker Basic path stays historical. This marker is internal preparation data, not a tag, authored accuracy field, client intent or standalone automatic action. Validate its shape/source compatibility and strip it from actual public projections.

The root and its inherited modifier packets share one Basic hit result. Preserve the existing committed Basic Accuracy/Evasion, facing/status/clamp and terrain Evasion arithmetic; the current Basic helper does not use Skill Target Elevation to bypass terrain Evasion. Preserve its original hit/critical draw count and truthful native result receipts. Apply Basic Defense only to original root packets; each appended packet retains its own explicit scaling/Defense, including Pierce. Shared preparation/forecast/commit and legal miss payment/limits remain one command.

Test seeded ordinary-vs-composed Basic hit/miss/critical/RNG, elevated recipients, root-vs-modifier Defense, exact preview/commit, invalid private markers and safe service projections. This narrowly resolves current native adapter plumbing; it does not change authored canonical Basic conversion authority or replace native damage/hit execution.

## Canonical Resonance source clarification — Ruling12

The existing V1/V2 Resonance Ability envelopes require a truthful `resonance` captured-source kind and existing `family: resonance` packet origin. Add this strict private literal/validator mapping and route actual canonical container behaviors through the same shared command/event authority before guarded legacy sequence projection. Historical absent-envelope paths retain their semantics. Resolve the full enabled producer with exact owner/build Discipline-pair, ID and version authority; stored immutable captures outrank changed catalogue definitions. Do not alias as Skill/Essence, invent a single source Discipline from the pair, accept client definitions or relax unsupported canonical paths into legacy fallback. Cover V1/V2 create/forecast/commit/reconnect, malformed/identity/version/ownership/source-removal admission, payment/limits/cooldowns, pending packet origins and actual service privacy. This is bounded existing container integration, with no new mechanic or authoring scope.


## Standalone Automatic ordering clarification — Rulings13–14

`docs/superpowers/specs/2026-10-10-automatic-action-order-design.md` and its continuation plan `docs/superpowers/plans/2026-10-10-automatic-action-order.md` now define standalone Automatic actions and the missing target binding. Modifier composition still uses immutable S0 before payment; actual standalone before-use hooks run at paid S1 before native resolution. Their children never recompose/repay the parent. Committed admission is engine-issued, original live geometry is rechecked, paid interruption retains costs and native independent actor packet rules, and exact mutation frames dispatch after native Absorb/Reflect before terminal checks. Child effect gates use child pre-payment subjects with parent causal/event facts, never parent resources as child owner. Atomic mutation receipts deduplicate one behavior and child queues never drain the parent queue. Strict persisted full-tree truth and explicit Automatic owner/triggering/selected/affected binding follow the new specification. Earlier broad Automatic-event integration remains outstanding; these documents do not accept Task2.
