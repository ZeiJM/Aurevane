Implement the following Aurevane combat targeting-shape rework in the current `ZeiJM/Aurevane` repository.

Work from the latest `main` and inspect the existing targeting, preview, execution, AI, Master Panel authoring, validation, battle UI, PvE/PvP/spectator parity, documentation and tests before changing anything. Preserve server authority and historical/pinned battle compatibility. Do not reset newer work or absorb unrelated Combat/Nexus/animation/layout changes.

## Targeting methods

The current player-facing targeting methods should become:

- Single
- Line [X]
- Circle [X]
- All

Targeting geometry and effect recipient/team policy must remain separate concepts. A targeting shape determines which battlefield positions belong to the footprint. Team/recipient/friendly-fire rules determine which occupants actually receive each effect.

---

## 1. Single

Keep Single as Aurevane's normal precision-targeting method.

A Single Skill selects exactly one legal primary target within its authored range.

Depending on the authored target kind/team policy, this may be:

- one enemy;
- one ally;
- self;
- anyone;
- one ground tile;
- one empty tile where supported.

Examples:

- `Single · Range 1` = select one legal adjacent target.
- `Single · Range 4` = select one legal target up to four tiles away.
- Basic Attack remains effectively a cardinal adjacent Single enemy attack.

Do not turn Single into an AoE shape.

Its UI should highlight individually legal target candidates and then wait for the player to choose one.

---

## 2. Line [X]

Rework Line so that it is a directional multi-target footprint originating from the caster.

`Line [X]` means:

- the caster is the origin;
- choose one of the four cardinal directions: Up, Down, Left or Right;
- the footprint extends X tiles in that direction;
- the line is one tile wide;
- every tile along that line belongs to the effect footprint;
- every valid combatant occupying those tiles may be affected according to the Skill's authored team/friendly-fire/effect-recipient rules.

Example:

`Line [4]`

Caster facing/aiming right:

`P 1 2 3 4`

If enemies occupy tiles 1, 3 and 4, all three can be struck by the command.

Combatants themselves must NOT stop Line propagation.

Terrain, walls, elevation, line-of-sight or other blocking rules may stop or invalidate propagation only where the Skill's authoritative targeting rules require that behavior.

Line targeting should therefore be direction-based rather than requiring the player to select one enemy as the primary conceptual target.

### Line UI

Selecting a Line Skill should expose the four legal directional lanes.

Hovering/selecting a direction should preview:

- every affected tile;
- every affected combatant;
- legal/illegal direction state;
- forecasted effects on each applicable recipient.

The full footprint must remain visible even when some tiles are empty.

---

## 3. Circle [X]

Replace aimed/remote Circle behavior for current targeting with a caster-centered expanding grid radius.

Circle always emanates from the user/caster.

Use square-grid/Chebyshev distance rather than attempting to approximate a Euclidean circle.

### Circle [1]

Affects the eight tiles immediately surrounding the caster:

X X X  
X P X  
X X X

The caster's own tile is NOT part of the external Circle footprint by default.

An authored actor/self effect in the same Skill may still affect the caster independently.

### Circle [2]

Expands one additional square ring around Circle [1].

The complete footprint is a 5x5 square centered on the caster, excluding the caster's own tile by default:

X X X X X  
X X X X X  
X X P X X  
X X X X X  
X X X X X

Circle [2] therefore includes BOTH:

- Ring 1: 8 tiles;
- Ring 2: 16 additional tiles.

Total external footprint: 24 tiles where the board permits them.

Continue this pattern for larger values:

`Circle [X] = all battlefield tiles with Chebyshev distance <= X from the caster, excluding the caster tile unless an authored self effect separately applies.`

Do NOT interpret Circle [2] as only the second ring.

If a ring-only mechanic is ever desired later, that should be a separate future targeting concept rather than overloading Circle.

### Circle UI

Circle should not require the player to choose a destination tile.

Selecting a Circle Skill should immediately preview the caster-centered footprint.

The command can then be confirmed/executed.

Show the full footprint including empty tiles and identify all affected combatants according to the Skill's authored recipient rules.

---

## 4. All

Add a new targeting method named:

`All`

All ignores positional distance when determining the shape footprint.

It must support at minimum:

### All Enemies

Targets every legal enemy combatant currently on the battlefield regardless of:

- distance from the caster;
- direction;
- ordinary range;
- relative position.

### All Allies

Targets every legal allied combatant currently on the battlefield regardless of position.

Whether the caster counts as an ally/self recipient must follow the Skill's authored team/recipient policy rather than being silently assumed.

### All / Anyone

Where the authored target/team policy allows anyone, All may encompass every legal combatant on the battlefield.

### All Ground

When target kind is Ground, `All` means the complete legal battlefield ground/tile footprint.

Every valid battlefield tile is included regardless of distance from the caster.

This allows future effects such as battlefield-wide terrain effects without inventing fake Circle radii.

Do not require the user to click every unit/tile individually.

### All targeting rules

`All` is a targeting SHAPE/method, not a hard-coded enemy attack.

The existing target kind/team policy/effect-recipient/friendly-fire system must decide what within the global footprint actually receives each effect.

Examples:

- All + Enemy = every legal enemy.
- All + Ally = every legal ally.
- All + Anyone = all legal combatants.
- All + Ground = all legal battlefield tiles.
- All + Ground with an effect that only modifies eligible tiles = only those legal effect recipients actually resolve.

All should normally ignore ordinary minimum/maximum positional range and ordinary directional LoS because global coverage is its defining identity.

However, keep authoritative validation explicit rather than silently making contradictory authored combinations work. If existing schema fields such as min/max range or LoS become meaningless for All, normalize or reject those combinations clearly in the authoring contract.

---

## 5. Shape identities

After this change, the intended tactical identities are:

### Single

Precision.

"Choose exactly who or what I want."

### Line [X]

Directional alignment.

"Punish everything positioned along this lane."

### Circle [X]

Caster-centered proximity AoE.

"Put myself in the right position and affect everything around me."

### All

Battlefield-wide reach.

"Affect every valid recipient of this category regardless of location."

Keep these identities mechanically distinct.

---

## 6. Range semantics

Reconcile the existing targeting schema so range means something sensible for each method.

Recommended contract:

- Single: authored minimum/maximum range remains authoritative.
- Line [X]: X is the line length from the caster; do not require a separate destination-target range concept for ordinary Line usage.
- Circle [X]: X is the caster-centered grid radius.
- All: positional range does not restrict the global footprint.

Avoid redundant or contradictory shape/range state.

Preserve immutable historical Skill/battle definitions through explicit compatibility/version handling rather than reinterpreting old pinned definitions.

---

## 7. Preview and battle interaction

Update the shared targeting/preview system so damaging or otherwise previewable Skills expose their true footprint before commit.

Required behavior:

### Single

Show all individually legal selectable candidates.

### Line

Show all four potential direction lanes where appropriate. Once a direction is selected, show the complete line footprint and every affected recipient.

### Circle

Immediately show the complete caster-centered footprint.

### All

Immediately show every eligible affected unit or ground tile across the board.

Empty footprint tiles should remain visible for Line, Circle and All-Ground where relevant.

Do not make the preview dependent on whether a combatant currently occupies a tile.

Preview must remain informational and must not mutate state, consume RNG, apply statuses, advance counters or alter authority.

---

## 8. Directional controls

Ensure Line integrates cleanly with current keyboard/mouse targeting.

At minimum:

- Up
- Down
- Left
- Right

must correspond to the four cardinal Line directions.

Do not require diagonal Line directions unless separately approved later.

Preserve keyboard accessibility and mouse/touch usability.

---

## 9. Server authority and execution

The server remains authoritative for:

- target legality;
- footprint resolution;
- actual affected recipients;
- team/friendly-fire filtering;
- LoS/elevation where applicable;
- damage/status/effect execution;
- battle state mutation.

The client must never be able to provide an arbitrary list of victims or affected tiles and have the server trust it.

The committed command should provide only the necessary targeting decision, such as:

- selected Single target;
- selected Line direction;
- Circle activation;
- All activation.

The server must reconstruct and validate the authoritative footprint.

---

## 10. AI

Update Recruit/AI targeting so it understands the new semantics.

AI evaluation must:

- evaluate each legal Single candidate;
- evaluate legal Line directions and all recipients in each line;
- evaluate the caster-centered Circle footprint;
- evaluate the complete All footprint.

Utility should be based on actual projected effects on all recipients and should respect allies/enemies/friendly fire.

AI must not evaluate Line as if only one target were hit or Circle as a remote aimed AoE.

---

## 11. Master Panel / Combat Content authoring

Update the targeting authoring UI and schema as required.

The authoring interface should cleanly expose:

- Single
- Line [X]
- Circle [X]
- All

For Line and Circle, X must be a valid positive authored integer within reasonable engine limits.

For All, do not require a meaningless X value.

Ensure target kind/team policy can still independently author:

- Self
- Ally
- Enemy
- Anyone
- Ground
- Empty Tile where applicable.

Validate impossible/contradictory combinations server-side.

Presentation tags should derive automatically:

- `Line [X]`
- `Circle [X]`
- `All`

Do not manually encode display tags separately from authoritative targeting definitions.

---

## 12. Existing Skills and migration audit

Audit the current published Skill/Essence catalog for every existing Single, Line and Circle definition.

Do not mechanically change unrelated Skill balance.

Identify which current Line/Circle Skills would materially change behavior under the new geometry.

Current authored/current-player-facing Skills should be migrated/versioned appropriately so they use the intended new behavior.

Historical immutable versions and ongoing pinned battle snapshots must keep their old behavior where required for replay/state compatibility.

Do not silently reinterpret historical content.

---

## 13. Shared parity

The same authoritative targeting behavior must be used by:

- PvE;
- PvP;
- AI/Recruit;
- spectator presentation;
- previews;
- execution;
- Master Panel validation;
- battle logs/inspection where targeting shape is presented.

Avoid separate divergent client-only geometry implementations.

Prefer one shared authoritative shape resolver with thin presentation adapters.

---

## 14. Tests

Add/adjust focused tests covering at minimum:

### Single

- one target only;
- authored range;
- ally/enemy/self/ground legality;
- preview/commit parity.

### Line

- cardinal directions;
- correct X length;
- all occupants in the line are affected;
- empty tiles remain part of footprint;
- combatants do not stop propagation;
- team/friendly-fire filtering;
- board-edge clipping;
- LoS/terrain interaction where applicable;
- preview exactly matches commit recipients.

### Circle

- Circle [1] = 8 neighboring tiles when fully on-board;
- Circle [2] = 24 external tiles when fully on-board;
- Circle [2] includes Circle [1];
- caster tile excluded from external footprint by default;
- actor effects may independently affect caster;
- board-edge clipping;
- all valid occupants are affected;
- team/friendly-fire filtering;
- preview/commit parity.

### All

- All Enemies includes all legal enemies anywhere on board;
- All Allies includes all legal allies anywhere on board;
- correct self inclusion/exclusion from authored policy;
- Anyone behavior;
- All Ground includes complete legal battlefield tile set;
- positional range does not accidentally remove remote targets;
- no arbitrary client-supplied recipient list is trusted;
- preview/commit parity;
- PvE/PvP/AI behavior.

Also cover serialization/schema compatibility and historical pinned definitions.

---

## 15. Documentation

Reconcile relevant current combat/Skill/Master Panel documentation so there is one unambiguous current definition of:

- Single
- Line [X]
- Circle [X]
- All

Explicitly supersede stale documentation describing remotely aimed Circle behavior or single-recipient Line behavior where it conflicts with this Owner-approved targeting design.

---

## 16. Implementation quality / release boundary

Make small reviewable changes and verify the live repository state before editing.

Run the relevant unit, integration, targeting, AI, browser and battle parity checks.

Do not claim completion until the authoritative resolver, preview, execution, AI and authoring paths agree.

You may implement the code and prepare the PR/verification work, but do not perform unrelated cleanup or alter unrelated combat systems just to make this change easier.

Preserve all existing server-authority/security guarantees.
