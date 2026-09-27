# Uncapped Effect Stacking Design

## Goal

Make the forward combat rule simple and consistent: persistent combat effects have no authored/gameplay stack cap, while player-facing descriptions stop using “stack/stacks/stacking” as explanatory copy.

This is an explicit Owner-requested combat-rule redesign. It does not authorize a balance rebalance, Production deployment, or reinterpretation of already-pinned historical battles.

## Player-facing language

- Skill/effect descriptions must not use “stack”, “stacks”, “stacking”, “stackable”, or cap language such as “up to three stacks”.
- Quantity is shown directly when useful, for example `Guarded ×5`, rather than “5 stacks of Guarded”.
- Status descriptions explain the per-application behavior itself, not that the effect “stacks”.
- Battle status badges may continue to use the compact `×N` count because that communicates quantity without redundant “stack” wording.
- Internal field/type names may retain `stacks` where changing them would create churn; this rule is about gameplay semantics and player-facing language, not cosmetic internal renaming.

## Forward rules boundary

- New battles use a new stacking-rules version with no authored/gameplay cap.
- Already-pinned historical battles retain the stacking semantics of the rules version they started with.
- “Uncapped” means no game-design maximum. Technical integrity still fails closed before integer/storage overflow; the implementation must never wrap, corrupt state, emit Infinity/NaN, or silently truncate an application.

## Persistent effect semantics

### Aggregate status effects

Repeated applications of the same status identity are accumulated rather than clamped to `maximumStacks`.

- The count increases by the applied quantity.
- Existing duration-refresh behavior remains unless that effect family already has explicitly independent durations.
- Per-application magnitude is applied once per accumulated application where the effect is numerically additive/multiplicative.
- Binary effects such as Root remain binary in outcome: additional applications increase the active count and follow the normal duration rule, but cannot make “cannot move” more true.
- Existing independent system safety/balance ceilings are not silently removed merely because applications are uncapped. Examples include HP/max HP, MP/max MP, AP minimums, board legality and any explicitly separate combined-tempo cap. Those are outcome-system limits, not application-count limits.

### Current DOT families

The current separate DOT runtime must follow the same no-cap rule.

- Bleed: remove the three-instance gameplay cap. Each application remains an independent timed instance.
- Burn: reapplication must no longer replace/restart the only Burn instance for the forward rules version; separate applications coexist and resolve independently.
- Poison: reapplication must no longer collapse to a single target instance for the forward rules version; separate applications coexist and each keeps its own movement/end-turn bookkeeping.
- Cleansing/removal of a DOT identity removes all active matching instances unless a future authored mechanic explicitly defines partial removal.

### Recovery and Barrier

Existing independent recovery/barrier instances remain independently additive. Do not introduce a new cap.

## Status copying

Amplify/Curse-style status copying must not reintroduce caps.

- Copy the eligible currently-active application quantity/instances allowed by the existing copy eligibility rules.
- Do not clamp copied quantity to a status definition’s legacy `maximumStacks`.
- Preserve provenance and remaining-duration semantics.
- Existing exclusions and publication safety rules remain unchanged.

## Legacy schema compatibility

`CombatStatusDefinition.maximumStacks` currently exists throughout historical content and published definitions.

- Do not mutate historical definitions solely to erase this field.
- Treat it as legacy rules metadata for historical rules versions.
- Forward runtime semantics must not use it as a gameplay clamp.
- Authoring/validation may continue accepting legacy pinned definitions, while current preview/presentation must not advertise the legacy cap as a current rule.

## Numeric safety

Removing gameplay caps must not create unsafe arithmetic.

- Application counts remain positive safe integers in serialized state.
- Addition beyond the safe representable range fails closed instead of clamping or wrapping.
- Damage/healing/modifier resolution must use overflow-safe arithmetic and may short-circuit at meaningful outcome bounds (for example, lethal damage does not need an astronomically large intermediate number).
- Rendering and API serialization must remain finite and deterministic for very large legal counts.

## Presentation updates

Update every current player-facing path that explains effect quantity/caps, including:

- character Skill detail effect descriptions;
- Skill preview/effect summaries;
- status detail/duration descriptions;
- battle inspect/status assist copy;
- Master Panel deterministic preview/review text where it uses the shared presentation helpers.

Examples:

- `Apply 5 Guarded stacks to the selected unit.` → `Apply Guarded ×5 to the selected unit.`
- `Bleed stacks independently up to three times.` → `Each Bleed application resolves independently.`
- `Copied stacks respect caps.` → `Copied applications preserve their active quantity and remaining duration.`
- `Reapplying does not stack.` → describe the actual refresh/consumption rule without the word “stack”.

## Verification

Tests must prove both old and new authority semantics.

1. Historical/pinned rules retain their existing cap behavior.
2. A forward-rules status can exceed every previous authored cap (including >3 Guarded) and preserves deterministic state.
3. Forward Bleed accepts more than three concurrent instances and ticks/removes them correctly.
4. Forward Burn supports multiple concurrent applications without replacement.
5. Forward Poison supports multiple concurrent applications with independent movement/end-turn bookkeeping.
6. Status copy preserves uncapped quantity/instances without legacy clamping.
7. Large legal application counts never produce unsafe integer state, NaN, Infinity or silent truncation.
8. Current player-facing Skill/status descriptions contain no “stack/stacks/stacking” wording or “up to N stacks” cap language.
9. Compact battle quantity badges continue to render `×N` correctly.
10. Existing combat security, provenance, replay, publication and pinned-content tests remain green.

## Non-goals

- No automatic rebalance of damage/AP/MP/cooldowns in this slice.
- No change to which effects are copyable.
- No new supernatural mechanics.
- No Phase 5 release, Production deployment or live database migration.
- No unrelated Nexus/presentation work.
