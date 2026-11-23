# Automatic Action Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. This is the existing Task2 continuation: one sole High implementer, one combined independent original-BASE Task2 gate when complete, then the existing final whole-branch gate. Do not split these steps into concurrent workers or create another broad review.

**Goal:** Finish truthful before/outcome Automatic actions around one paid root, explicit target binding and persisted condition transitions, then complete the original Task2 real-caller integration.

**Architecture:** Commit the prepared canonical/native bundle once; execute paid-state before children; recheck live original selection; settle or record paid interruption through existing native helpers. Capture immutable per-mutation outcome frames, update condition memory at capture, and dispatch at the native committed-reaction seam after Absorb/Reflect. One shared guard and injected child executor avoid a second damage path and command/event module cycle.

**Tech Stack:** Existing TypeScript game-core/validation/Next.js server, Vitest, Node24 and pnpm11.17.0; existing private capture/state and battle-service CAS.

**Spec:** `docs/superpowers/specs/2026-10-10-automatic-action-order-design.md`. Also consume the main recovery design/plan, Manual modifier command specification/plan, complete current Task2 brief/report and exact original Owner brief.

## Global Constraints

- Structured definitions determine mechanics; descriptions never create rules. Stable IDs, typed units and explicit effect order are mandatory.
- Build on `ee5d49de449851c9b9aa61438735c4cd27ca6af4` or newer main. Preserve elemental policy 2, Suppress percentages, all historical optional policies, captured effects and exact-version battle snapshots.
- Do not change unrelated damage formulas, progression, AP economy, movement limits or resource recovery. Preserve current roster balance through Tasks 1–13/3A; Tasks 14–15 design and implement the Owner-authorized final roster rebalance through new immutable versions. Current `armor`/`ward` mean Physical/Mystic Defense, not future equipment Armor.
- New HP costs leave at least 1 HP and do not emit damage events. AP/MP/HP costs commit together once per legal activation.
- Self and Ally are separate. New ordinary targeting permits up to the configured count of distinct legal selections. Line and caster-centered square-ring Circle retain existing geometry. New All bypasses Range while independently configured LoS/elevation remains; historical geometry v2 is preserved.
- Controlled first use primes the whole Manual action without ordinary payment, action consumption or cooldown; one prime per character/ability/battle. Legal release pays once and consumes the prime; invalid release retains it. Rewind captures its existing position anchor on prime. No arbitrary expiry, automatic release or refunds.
- Pierce power is 1–20; Armor Ignored is 0–100% of the recipient's explicit future equipment Armor contribution, separate from scaling and all other mitigation. Without equipment Armor, explain that configured bypass has no current advantage. Preserve legacy `piercing:true` semantics in historical definitions.
- Selecting Fire/Ice/Water/Storm damage inserts explicit required companion mechanics, locked in authoring and enforced by validation/execution. Preserve policy-2 application conditions, magnitudes, timing and expiry; no duplicates.
- Public field order is Type, Cost, Cooldown, Requirements, Effects, Range, Target, Method, Target Elevation, Line of Sight. Values use brackets; independent entries use a middle dot. Public API/RSC/preview payloads omit authoring accuracy fields.
- Save Draft is not Publish. Publish appends a complete atomic version with optimistic concurrency. Restore copies a complete prior snapshot into a draft, then publishes a new version. UI shows current plus two previous published versions; older referenced snapshots remain physically readable.
- Six primary destinations: Game Content, Combat Rules, Events & Live Ops, Players, Staff & Access, Site Music. Preserve the global character rail, header/account entry and footer; compact desktop layouts remain usable at mobile and 200% zoom.
- Staff grants belong only to the explicitly selected linked character and are checked for expiry/revocation on every protected server/RPC operation. Single Game Owner and nondelegable powers remain protected. Ambiguous legacy grants fail closed until explicitly bound.
- Administrative battle recovery is durable no contest/no rewards, never ordinary surrender/defeat; identify all affected participants before voiding a shared encounter. Late workers/retries cannot grant rewards or records. Do not invent resource refunds.
- Routine written reasons are removed from forms, relevant TS validation and SQL contracts without fabricated reasons; automatic actor/time/action audit remains.
- New migrations use `pnpm exec supabase migration new` after CLI help, preserve existing migration files and service-only grants/RLS, and are tested locally/PGlite. Never mutate hosted production during Tasks 1–16. The Owner-authorized final release applies only reviewed necessary hosted changes after acceptance, independent whole-branch review and current-state reconciliation. Preserve `apps/web/vercel.json` Git deployment lock.

## Review Focus

1. **Payment/admission split:** no hook on rejected input; paid interruption never repays/refunds/rechecks its started cooldown; Manual activity is recorded before children. Steps2/3/6 assert concrete resources/sequence/receipts and real adapter behavior.
2. **False event/truth timing:** mixed Any/All witness, per-mutation crossing and held-state persistence must not be reconstructed from final state or rolled backward at queued dispatch. Steps1/4/5 cover actual mutation, restore and source removal.
3. **Native ordering/RNG/companions:** preserve Basic/native seeded hit/critical/Reflect and Fire actor cleanse, with no root accuracy on interruption and no fabricated positive loss. Steps3/5 assert exact native receipts and guard.
4. **Target/authority/privacy:** explicit bindings, immutable role IDs/current live geometry, fabricated commitment/session rejection and actual DTO stripping. Steps1/2/4/6 cover missing roles, invalid relations, no fallback and public services.
5. **Real boundary/CAS integration:** AP preparation cannot erase incoming Automatic expenditure/new clocks; pending cannot repay; replay/fingerprint/AI/PvP and canonical Resonance must use the actual route. Steps5/6 provide production caller tests, not helper-only proof.

## Status and execution gate

No implementation is performed by this architecture plan. Product checkpoint remains `21130eccddb05c4aee5e7876826b47d8bfe95bc4`; its narrow88 core/29 web checks and earlier adapter2864 core results are separate retained evidence, not proof of this plan. Task2 review BASE remains `3d9304eef498f32dafd6fe1447cbe3a3fa089faa`. Original source/event/maintenance/container/epoch/AI/privacy obligations remain; this plan adds their concrete ordering contract.

Root finishes/checkpoints this plan under the Owner's14:25:57 Extra High approval, then pauses for an explicit return-to-High confirmation. Only then resume the sole implementer with full brief/report/spec/plan. Existing implementation approval requires no repeat design-choice prompt. Record each actual command/cwd/UTC/exit/log in `evidence/task-2/verification.jsonl`; append full results and limits to `task-2-report.md`.

## File ownership and private interfaces

| File/module | Responsibility |
| --- | --- |
| `combat-definition.ts` + test | Strict `automaticTarget`, activation applicability and actual event/phase capability admission |
| `combat-requirements.ts` + test | Pure full-tree event witness/state projection and actual resource mutation context |
| New `combat-ability-events.ts` + test | Explicit capability catalogue; detached frame/session; role binding; shared deterministic dispatch with injected command callback |
| `combat-behavior-runtime.ts` + test; capture/state validators | Strict optional condition truth, immutable capture, archive/reconcile, real activation/restore distinctions |
| `combat-ability-command.ts` + test | Commit once, issue exact committed context, before children, live recheck, one attempt/interruption, returned shared guard |
| `combat-modifier-composition.ts` + test | Child pre-payment subjects; immutable affected eligibility over available activation universe |
| `actions.ts`, `actions-legacy.ts` + owning native tests | Mutation capture; narrow committed actor settlement using original resolver/ordinals; native reaction seam; no duplicate use/payment |
| `pv1f-action-economy.ts`, Mature/Essence/Resonance/native/AI adapters | Real orchestration predicate, idempotent incoming preparation, preserved trusted Basic behavior/quote |
| Actual web battle build/session/preview/final-turn/PvP/public-log service files | Exact capture/refreeze, same authoritative command, CAS replay/fingerprint, private-safe DTOs/Chronicle |

Planned private contracts (export only the core consumers that need them):

```ts
type AutomaticAbilityTargetSubject = 'owner' | 'triggering' | 'selected' | 'affected'
// AbilityBehavior.automaticTarget?: { readonly subject: AutomaticAbilityTargetSubject }

interface AutomaticRequirementTriggerResult {
  readonly holds: boolean
  readonly stateTruth: boolean
  readonly eventMatched: boolean
  readonly stateEntered: boolean
}
// evaluateAutomaticRequirementTrigger(requirement, immutableContext, priorStateTruth)
//   -> AutomaticRequirementTriggerResult; pure, including exact All/Any witnesses.

interface CombatAbilityEventFrame {
  readonly id: string
  readonly mutationOrdinal: number
  readonly events: readonly { readonly type: string; readonly phase: 'before' | 'after' }[]
  readonly subjects: readonly {
    readonly combatantId: string
    readonly before?: AbilityRequirementSubjectState
    readonly after: AbilityRequirementSubjectState
  }[]
  readonly actionFacts?: NonNullable<AbilityRequirementContext['event']>['action']
  readonly triggeringCombatantId?: string
  readonly selectedCombatantId?: string
  readonly affectedCombatantIds: readonly string[]
  readonly resourceMutations: readonly {
    readonly combatantId: string
    readonly resources: readonly ('ap' | 'mp' | 'hp')[]
  }[]
  readonly placements: readonly {
    readonly combatantId: string
    readonly before?: GridPosition
    readonly after: GridPosition
  }[]
}
```

Action facts use the actual producer's nested `event.action` type above. Frame event types are narrowed by the explicit supported catalogue. A mutation-only frame has an empty receipt array and no authored event alias. A single atomic payment frame may carry several real expenditure receipts; evaluate witnesses per actual receipt context and union once per behavior/mutation with crossing/state entry. Never combine unrelated receipt contexts to satisfy All. Missing-before/created subjects remain explicitly unavailable. Each command owns its outcome queue while the transient root session owns the common guard/dedup; a child seam drains only the child's queue.

`resolveAutomaticAbilitySelection(state, source, behavior, frame)` returns either a supported native selection or a named private suppression; no fallback. `processCombatAbilityEvent(state, frame, content, context, session, executeAutomatic)` returns the whole transition with the updated session/guard. The injected callback accepts `CombatAbilityCommandInput` and returns `CombatResolutionTransition`; events use type-only command imports. Candidate impulses hold immutable predicate results/roles, while dispatch checks live source, target, costs and limits. Session is transient, shares the returned native guard and has no serialized/client entry point.

Keep committed execution issuance/validation module-private and bound to actor/root/command/turn/selection/provenance. Expose a narrow native settlement option only from successful commit; never an authored/client bypass flag. Preserve facade signatures `prepareCombatAbilityCommand`, `commitCombatAbilityCommand`, `evaluateCombatAbility` and `activateCombatAbility` while adding private context/session inputs only where necessary. Record actual final consumed signatures in the complete report for downstream tasks.

## Step 1: Strict target/phase model and pure Requirement pulses

- [ ] Add failing tests in `combat-definition.test.ts`, `combat-requirements.test.ts` and new `combat-ability-events.test.ts`: Automatic single-unit missing binding; Self owner omission; forbidden Manual/modifier/Ongoing extra field; missing role and unknown subject; unsupported event/before phase; mixed `Any(lowHP,event)` held lowHP does not reproc on unrelated events; `All(action,eventBefore)` and action-only after pulse; exact threshold crossing, payment crossing without damage, unavailable nonowner unanchored state branch.
- [ ] Run `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-definition.test.ts src/combat/combat-requirements.test.ts src/combat/combat-ability-events.test.ts`. Expected RED is the named missing-contract assertion, not setup/import failure.
- [ ] Add strict typed `automaticTarget` and exact supported catalogue from spec. Implement pure normal truth, satisfying event witness and full-tree state projection. Extend typed Requirement context with explicit actual resource-mutation evidence; do not let preview snapshots imply crossings. Check anchors per satisfiable state branch without exponential DNF expansion; reuse bounded depth8/nodes128 traversal.
- [ ] Run the same tests and `pnpm --filter @aurevane/game-core typecheck`; expect all assertions pass and parser absent-field history stable. Scoped commit only these own model/event-evaluation paths. Do not accept an event catalogue entry before its actual native handler is wired in Step5; fail closed during this intermediate checkpoint.

## Step 2: Exact committed admission and before-child orchestration

- [ ] RED in command/event tests: illegal explicit bundle emits no hook/spend/usage/RNG; root30AP plus before child5AP from100 leaves65 once; unaffordable child pays0 and parent resolves; HP aggregate leaves1; just-started cooldown does not reject the committed root; root usage/activity/sequence exists before child; no Manual attachments inherited by child; fabricated/mismatched committed context rejects.
- [ ] Run `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-ability-command.test.ts src/combat/combat-ability-events.test.ts src/combat/combat-modifier-composition.test.ts`.
- [ ] Issue the private committed context only after atomic bundle admission. Record single native-shaped attempt receipt; suppress only its duplicate legacy emission. Lock participants, definitions, effective gates/timing and selection, record existing Manual activity once. Capture actual payment frame and dispatch the separate S1 before hook via injected `commitCombatAbilityCommand`. Child Requirements use parent immutable trigger, child costs/live legality use current state, child packet gates use its own pre-payment subjects. Retain one guard; optional modifiers never recomposed after a child.
- [ ] Recheck original actor/turn/lifecycle/current target geometry without rechecking committed payment/cooldowns/limits/activation predicates. Bind target roles/current placements before child admission. A removed parent source does not rewrite the paid capture. No value-import cycle or second damage function.
- [ ] Repeat targeted tests/types and scoped lint/format/diff. Scoped commit only command/event/context/composition paths. Report exact transient context authority and actual guard threading.

## Step 3: Truthful paid interruption and native actor-only settlement

- [ ] RED: before counter defeats root actor; before child defeats/hides/moves primary out of legality; primary moves but stays legal; source removed after commitment; Fire root loses target while living actor is Chilled; actor-only delayed cleanse/gated packet; Blindside cannot trigger without positive hostile loss; child RNG retained but interrupted root consumes no hit/critical/resistance draw. Assert costs/clocks/usage/activity remain, one use and one interruption, no enemy/ground/pending hit effect, no fallback and no double actor consequence.
- [ ] Run command/event plus owning native elemental/Basic tests chosen by `rg` from current suite; record exact filenames before command. Keep seeded ordinary Basic hit/miss/critical fixtures unchanged.
- [ ] Add minimal typed `combat_action_interrupted` outcome and reason enum. Implement narrow engine-only actor settlement around existing private `resolveActionEffects`, using original packet ordinals and an internal eligible ordinal filter. Preserve native commit-side actor consequences in one shared helper. No fake Self action, renumbering, blanket cooldown bypass, target allocation or extra RNG. Use existing native timing/origin/pending mechanisms, stop on actor death, and skip if terminal/wrong turn/dead.
- [ ] Extend actual Chronicle/public mapper with the safe interruption receipt; detailed private suppression remains internal. `used/after` fires for interrupted committed attempts, `damage/after` only for real damage. Verify no hidden reactor fields or false hit/miss copy.
- [ ] Targeted native/command/public projection tests plus affected types/scoped checks pass, then scoped commit. Record helper boundary and whether native attempt-side actor effects have conditions beyond authored actor packets.

## Step 4: Persist condition truth and deterministic bounded dispatch

- [ ] RED: false→true lowHP once; multi-mutation down/up/down produces exact captured impulses; unchanged truth on readers/preview/JSON restore; missing optional memory seeds silently; removing/readding same source retains truth/usage; fresh actual activation may trigger once; mixed event branch still pulses while state branch held; old queued frame never rolls truth backward; explicit counter targets triggering and heal targets affected; absent/illegal role0cost; duplicate frame, depth8 and budget32 suppress without payment.
- [ ] Run `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-behavior-runtime.test.ts src/combat/combat-behavior-capture.test.ts src/combat/combat-ability-events.test.ts`.
- [ ] Add strict optional `conditionTruth` to private schema1 runtime validation/capture/refreeze. Bound entries by known captured Automatic action inventory; reject duplicates/unknown IDs/wrong types. Reconcile source-owned truth/usage archive without deleting reactivation history. Distinguish creation/real source activation from restored/read initialization.
- [ ] Capture candidate witness and advance truth at actual mutation. Dispatch queued candidates in mutation order and exact source/behavior sort, child depth first, with live source/cost/target/limit admission. Consume returned native Reflect/child guard. Retain root once-per-action identity; root budget cannot reset per event/packet. No persistent unbounded dedup log.
- [ ] Same tests/types and scoped checks pass, then scoped commit. Report strict restore validator and actual truth update call sites; a synthetic helper alone is not full source lifecycle proof.

## Step 5: Capture actual native mutations, pending and prepared boundaries

- [ ] RED: two packet HP crossings retain their own before/after values even when final HP reverses truth; native Reflect precedes new outcome children and shares guard; direct vs payment/DoT/Ground facts are honest; pending settles before boundary Auto without new use/payment; actual `finishPv1fTurn` with prior AP0 yields incoming AP95/new cooldown retained/old cooldown ticked; no Manual activity/phantom turn/reward; terminal pending defeat prevents incoming Auto. Capture status expiry/application/removal and placement/barrier/movement/activity at their actual mutators.
- [ ] Run command/event and actual existing pending/turn/Ground/Reflect tests plus new owning integration regressions. Record exact scoped commands; no broad rerun without new code/failure reason.
- [ ] Instrument real mutation helpers with detached private frame capture. Add no authored event alias for a mutation lacking a public receipt. Wire every event claimed by the catalogue; an unsupported handler remains a named capability rejection. Queue outcome children after native Absorb/Reflect before terminal verdict, without new mid-packet execution. Drain child frames depth first and propagate final guard.
- [ ] Refactor actual incoming preparation into a shared idempotent seam: prepaid boundary work first, AP reset/old clock/epoch preparation before incoming hook, no later reset. Preserve old snapshots/absent-capture paths. Cover periodic and pending frame production at real settlement, not a replay of final event arrays.
- [ ] Targeted tests/types/scoped checks pass. Scoped commit native actions/boundary/owning regressions. Report one-to-one event catalogue→mutation producer mapping and any specifically unsupported event capability.

## Step 6: Finish all actual Task2 producers/services/privacy and gate

- [ ] RED actual create/refreeze/build/forecast/commit caller tests for canonical Resonance V1/V2, Mature/Essence and native Basic/Guard/Recover with relevant enemy/owner Automatic actions and zero modifiers. Cover stored captured-version precedence, source enabling/ownership, maintenance source A removal preserving B, every limit epoch, AI/PvP out-of-turn authority, duplicate CAS result and changed-modifier fingerprint conflict.
- [ ] RED actual preview/live/history public projections: no Requirement/accuracy/frame/session/condition/guard/commitment/raw origin leakage; pure preview consumes no RNG/truth/sequence/cooldown/prime and performs no hidden reaction simulation. Real Chronicle interruption contains minimal honest permitted fields.
- [ ] Route actual adapters/services through the common command whenever canonical/Automatic captures require it; preserve exact absent-field history. Use Ruling11 native Basic marker and Ruling12 real Resonance family/source identity. Persist the complete root+children transition under existing expected-version/idempotency authority. Finish the original complete Task2 brief rather than stopping after event helpers.
- [ ] Run actual owning service/projection/validation tests selected from existing files, core/validation/web types and scoped checks. Then one full core pass and the complete relevant actual web Task2 suite at the final product head. Broaden only for unresolved failures/new changes. Record counts without summing overlapping runs; an earlier checkpoint full pass cannot validate later code.
- [ ] Commit own tested paths and complete report from original BASE to final Task2 head, with every actual producer/consumer/signature/event capability/guard/private/public/pending/maintenance/restore contract. Root independently verifies checkpoint and requests one combined full Task2 reviewer under existing SDD. No Task3/3A/4 acceptance or deployment until this gate passes; scoped fix reviews stay limited to genuine gate findings.

## Downstream contracts and final verification

Task3 must extend the same target binding/immutable role contract into real plural/Line/Circle/All/Ground without nearest-unit or direction guessing. Task3A Move must intersect locked conditional eligibility with live reached geometry without a new payment/composition pass. Task4 must consume a legal release's prime/anchor/bundle at commitment, retain it only for invalid pre-commit input, and honor the Owner's readiness-only light overlay within existing artwork. Tasks5/7/10 authoring/readers must preserve explicit Automatic binding and honest before/after/state-transition language; supported event options derive from real capability catalogue.

Before implementation dispatch, root checks verbatim Global Constraints, exact Owner-brief hash,14 formal new rulings, unchanged deployment lock, spec/plan/brief consistency and no open timing/target/authority placeholders. These are documentation checks, not runtime evidence. Before Task2 acceptance, the independent gate checks the entire original-BASE implementation and actual retained final-head commands, including all earlier reviewed requirements. Final roster uniqueness/all-tag playtests and professional UI/release obligations remain later main-plan work.
