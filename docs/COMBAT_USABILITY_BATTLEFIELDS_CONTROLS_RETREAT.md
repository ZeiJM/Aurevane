# AUREVANE — Combat Usability, Battlefield Scale, Controls & Retreat

**Status:** Authoritative combat/interface addendum subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/COMBAT.md`, `docs/BATTLE_INTERFACE.md`, `docs/COMBAT_AI_TRAINING.md`, `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`, and `docs/ROADMAP_PRODUCT_VALIDATION.md`.

**Direction approved:** 2026-08-17.

Where this document is more specific than older supporting text, this document governs battlefield scale, combat onboarding/usability, final-facing ergonomics, keybinds, and voluntary battle exit/retreat behavior.

The purpose is to preserve AUREVANE's tactical depth while removing avoidable interface friction. A battle should be difficult because the tactical decision is difficult, not because the player cannot work out which button means attack.

---

# PART I — CURRENT PHASE-2 LESSON

## 1. Functional Does Not Mean Usable Enough

The Phase-2 combat engine already supports a real authoritative loop: movement, Basic Attack, Guard, final facing, End Turn, forecasts, battle persistence, and Recruit AI.

That proves system function. It does **not** by itself prove player comprehension.

If a new player can move but cannot quickly understand how to attack, why an action is disabled, what is still available this turn, or how to finish the turn, that is a PV-1 usability defect.

Do not postpone such problems to the final Phase-14 polish pass.

Phase 14 improves production art, animation, audio, and mature presentation. The basic interaction grammar must already be understandable before Phase 3 adds Arts, Reactions, Disciplines, equipment effects, and significantly more commands.

## 2. Combat Clarity Contract

During an ordinary turn, a player should be able to answer within a few seconds:

- whose turn is it;
- how much Movement remains;
- whether the Action is still available;
- what commands are currently available;
- why a command is unavailable;
- what clicking the board will do in the current mode;
- what target/destination is currently selected;
- what will happen if Confirm is pressed;
- what facing the character will end with;
- how to cancel;
- how to end the turn;
- whether retreat/surrender is available in this battle.

If the player must infer these from disabled buttons or remember an undocumented sequence, the interface is not finished enough for PV-1.

---

# PART II — ACTION FLOW & ONBOARDING

## 3. Make the Turn Grammar Visible

The battle interface should teach the turn through the interface itself:

```text
1. POSITION
2. ACT
3. REPOSITION IF MOVEMENT REMAINS
4. CHECK / ADJUST FACING
5. END TURN
```

This is a mental model, not a mandatory wizard that blocks experienced players.

On first encounters and Tactical Hall drills, the Turn Economy area may show a compact progress treatment such as:

```text
MOVE: 4/4   ACTION: READY   FACING: EAST   END TURN: READY
```

After an Action is committed:

```text
MOVE: 2/4   ACTION: SPENT   FACING: EAST   END TURN: READY
```

The player should not have to notice that two separate command buttons became gray and deduce that the Action was spent.

## 4. Action Buttons Must Explain Themselves

Every visible command has a clear state:

- Ready;
- Selected;
- Needs Target;
- Preview Ready;
- Spent;
- Insufficient MP;
- No Legal Target;
- Blocked by Status;
- Cooldown;
- Mode Disabled;
- unavailable for another explicit reason.

Disabled commands must expose a concise reason on focus/tap and, where space allows, directly on the command card.

Examples:

> **Basic Attack — Action already spent this turn.**

> **Guard — Action already spent this turn.**

> **Basic Attack — Move closer or choose a legal enemy.**

A generic dimmed button is not sufficient.

## 5. Selection State Must Be Obvious

The current interaction mode must be visually unmistakable.

Examples:

### INSPECT

> Select a unit or tile to inspect.

### MOVE

> Choose a highlighted destination. Path cost: 2 Movement.

### BASIC ATTACK

> Choose an enemy in range.

### FACING

> Choose the direction you want to defend after this turn.

### END TURN

> Review final facing, then confirm.

The board cursor, overlays, command card, planning panel, and short instruction should all agree about the current mode.

## 6. Progressive Combat Teaching

The first Tactical Hall sequence should teach concepts in small drills rather than exposing every future rule at once.

Recommended early records:

1. **Movement Drill** — move to highlighted positions and understand terrain cost.
2. **Strike Drill** — select Basic Attack, select target, read forecast, Confirm.
3. **Guard Drill** — demonstrate spending the Action defensively.
4. **Facing Drill** — deliberately expose front/side/rear consequences.
5. **Recruit Sparring Partner** — combine the learned rules in a complete duel.

Players who already understand the system can skip or rapidly complete these drills.

The current Recruit duel remains useful, but it should not be the only teaching surface once PV-1 usability work begins.

## 7. First-Use Coach Marks, Not Permanent Tutorial Clutter

Use restrained, dismissible/contextual coaching such as:

- pulse the currently relevant command once;
- highlight legal board tiles;
- show `Action Ready` before the first attack;
- explain that Move does **not** spend the Action;
- explain that Guard/Basic Attack do spend the Action;
- show why Basic Attack becomes unavailable after use;
- teach Confirm/Cancel;
- teach final-facing benefit during the dedicated facing drill.

Do not cover the battlefield in text boxes after the player has demonstrated understanding.

---

# PART III — BATTLEFIELD SCALE

## 8. The 5x3 Training Floor Is Not the Standard World Battle Size

A tiny board can be appropriate for:

- a movement tutorial;
- a basic attack tutorial;
- a deterministic QA fixture;
- a tiny duel pit;
- a very specific authored encounter.

It is **not** the default target for ordinary AUREVANE combat.

The mature game needs battlefields large enough for movement, range, flanking, terrain, elevation, objectives, Reactions, summons, and team composition to matter.

## 9. Scenario-Driven Scale, Not One Fixed Grid

Battlefield size is part of the authored `Battle Scenario Definition`.

Map size should consider:

- number of player-controlled combatants;
- number of enemies;
- expected summons/battle objects;
- Movement Budget range;
- melee/ranged engagement ranges;
- terrain density and traversal cost;
- elevation and line-of-sight;
- objective type;
- reinforcement routes;
- boss footprint/phase mechanics;
- desired flank opportunities;
- expected battle duration;
- screen/camera readability;
- device/browser performance.

Player count influences scale, but the board must **not** simply add X tiles per player. A 3v3 capture scenario may need far more space than a 3v3 enclosed ambush.

## 10. Initial Battlefield Size Bands

These are design/tuning bands, not immutable engine limits:

```text
MICRO / DRILL
roughly 5x3 to 6x5
Tutorials, deterministic tests, tiny duel spaces.

DUEL / SMALL ENCOUNTER
roughly 7x5 to 9x7
Normal 1v1 and compact PvE where flanking/terrain must matter.

SKIRMISH
roughly 9x7 to 12x9
2v2, 3v3, small enemy squads, objectives and multiple lanes.

LARGE / BOSS / OBJECTIVE
roughly 12x9 to 16x12+ where validated
Large creatures, several objectives, reinforcements, multi-lane or phase arenas.
```

The engine may support sizes outside these bands when measured performance and encounter design justify them.

Boards can use blocked/void/impassable terrain, walls, structures, elevation and irregular playable space so a rectangular data boundary does not mean every arena feels like an empty rectangle.

## 11. More Players Generally Means More Usable Tactical Space

As active unit count rises, map validation should usually increase usable area enough to avoid:

- immediate body blocking;
- every unit being in everyone else's range on turn one;
- no meaningful flank routes;
- summons making the board unusable;
- ranged AoE covering the entire fight trivially;
- three-player parties feeling like one crowded token pile.

However, bigger is not automatically better. Avoid giant empty maps that force several dead turns of walking.

## 12. Tactical Density Validation

A normal authored map should be reviewed for questions such as:

- Are there at least two meaningful approach/positioning options where the scenario calls for them?
- Can facing and flanking realistically matter?
- Can a melee combatant participate without spending most of the battle walking?
- Can a ranged combatant dominate from spawn without repositioning?
- Does terrain create decisions rather than decorative inconvenience?
- Are objective routes contestable?
- Are spawn zones fair and readable?
- Does elevation create advantage without unreachable immunity?
- Can the expected unit count fit without constant path obstruction?
- Are there meaningful safe/risky positions?
- Is the board still readable on a representative laptop and phone through pan/zoom?

Map validation should reject both **cramped meaningless boards** and **oversized walking simulators**.

## 13. Map Variety Is Tactical Content

Later map suites should intentionally vary:

- open vs constrained lanes;
- central obstacles;
- elevation;
- rough/slow terrain;
- hazards;
- cover/LoS blockers;
- interactable objects;
- objective placement;
- flank routes;
- spawn geometry;
- extraction routes;
- weather/event variants.

The same 5x3 or 7x5 geometry with different background art is not meaningful map variety.

---

# PART IV — FACING WITHOUT BUSYWORK

## 14. Facing Remains a Real Combat Mechanic

Facing is not cosmetic.

It may influence:

- front/side/rear damage relationships;
- Reactions;
- Guard/shield effectiveness;
- cones/arcs;
- directional cover;
- boss telegraphs/mechanics;
- equipment effects;
- Confluences;
- ally setup and flanking.

This is strategically valuable and should remain part of AUREVANE's identity.

## 15. Remove the Mandatory Extra-Facing Chore

The player should not normally need to perform a separate `Set Facing` command merely to make `End Turn` legal.

Instead, the game maintains a valid **provisional final facing** throughout the turn.

Default heuristics may be:

1. face the primary target of the most recent directional attack/action;
2. otherwise face along the final movement direction;
3. otherwise preserve current facing.

The current provisional facing is always visible.

The player may override it before ending the turn.

Therefore:

```text
END TURN
```

can normally be selected immediately, with the commit preview showing:

> Final facing: East

The player can change that facing before Confirm if desired.

## 16. Facing Override Should Be Fast

Desktop default direction inputs should allow fast final-facing selection.

Recommended default:

```text
W = North
A = West
S = South
D = East
```

when the current combat input context is `Choose Facing` / End-Turn preparation.

Pointer/touch players retain clear on-screen direction controls.

Facing keys do not commit End Turn by themselves.

## 17. Teach Why Facing Matters

The Facing Drill should visibly demonstrate consequences.

Example:

- attack a training dummy from the front;
- rotate the dummy;
- show side/rear forecast difference;
- let the player choose between facing the nearest threat or protecting against another flank.

This turns facing from an unexplained extra click into a rule the player can reason about.

---

# PART V — ACCOUNT CONTROLS & KEYBINDS

## 18. Controls & Keybinds Settings

AUREVANE should have a first-class:

```text
Account / Settings
  → Controls & Keybinds
```

surface.

Bindings should normally follow the account across desktop sessions where technically appropriate. Device-local exceptions may be stored separately for settings that do not translate between pointer, keyboard and touch.

## 19. Keybind Principles

- every important keyboard command remains available through visible UI;
- keybinds are convenience/accessibility, never server authority;
- keypresses produce the same normal preview/intent flow as clicking;
- destructive/high-consequence actions preserve confirmation unless the player explicitly enables a safe approved quick-input option;
- no hidden mandatory shortcuts;
- remapping detects conflicts;
- the player can restore defaults by category or globally;
- text fields/chat suppress gameplay shortcuts while focused;
- browser/OS-reserved shortcuts are not claimed carelessly;
- accessibility alternatives remain available.

## 20. Recommended Default Combat Bindings

Initial desktop direction:

```text
1              Inspect / neutral tool
2              Move
3              Basic Attack
4              Guard
5              End Turn preparation

W / A / S / D  directional input / final-facing input in facing context
Arrow keys     alternate directional navigation
Space          End Turn preparation / open end-turn confirm state
Enter          Confirm current legal preview
Escape         Cancel / go back one planning step
Tab            cycle relevant visible units/targets
Shift+Tab      reverse cycle
L              Combat Log
```

These exact defaults remain usability-testable and can change before release.

### Space does not silently throw away a turn

By default, `Space` should **prepare End Turn**, showing final facing and the commit summary.

`Enter` confirms.

A later optional `Quick End Turn` preference may allow a faster flow only if playtesting proves accidental forfeited turns are not a problem.

## 21. Directional Input Context

WASD should be context-sensitive but predictable.

Examples:

- in final-facing context: set facing;
- in keyboard board-navigation mode: move the board cursor/selection one tile;
- in text entry: type normally;
- it must never unpredictably move the character just because the user pressed `W` while trying to inspect.

Actual character movement remains a previewed/confirmed game command unless a future tested fast-input mode explicitly preserves the same safety.

## 22. Keybind UI

The settings page should show categories such as:

- General;
- Combat;
- World / Map;
- Menus;
- Social;
- Accessibility shortcuts where appropriate.

For each binding show:

- action name;
- current key(s);
- secondary binding where supported;
- conflict state;
- Reset action.

Include a searchable `Keyboard Shortcuts` help drawer accessible from combat.

Touch-only controls remain separately designed rather than pretending keybinds solve mobile interaction.

---

# PART VI — RETREAT, FLEE, SURRENDER & ABORT

## 23. Leaving Battle Is Scenario Policy

Not every battle permits the same exit behavior.

Every Battle Scenario should eventually declare an explicit `battle_exit_policy` or equivalent typed rule.

Supported conceptual policies:

```text
ABORT_PRACTICE
IMMEDIATE_RETREAT
TACTICAL_EXTRACTION
SURRENDER
NO_VOLUNTARY_EXIT
```

Names are illustrative; the typed meaning is the requirement.

## 24. Practice / Tactical Hall — Abort Exercise

Tactical Hall and ordinary no-reward practice should offer:

> **Abort Exercise**

Behavior:

- confirmation required;
- ends the practice run cleanly;
- no Character XP/Mastery/loot/Crowns/rating rewards;
- no normal loss penalty beyond the aborted practice record if one is kept;
- never traps the player in a training battle.

Training is where the player should be able to leave freely.

## 25. Standard PvE — Retreat

Many ordinary low-stakes AI/world battles may allow **Retreat**.

If the scenario uses `IMMEDIATE_RETREAT`:

- Retreat is available from the battle menu;
- explicit confirmation shows consequences;
- successful Retreat ends the encounter as `RETREATED`, not Victory;
- it counts as a loss/failed encounter for completion rules that care about win/loss;
- no victory XP, loot, objective rewards or completion credit are granted;
- combat consumables/resources already legitimately spent remain spent;
- explicit encounter entry costs already committed are not automatically refunded unless the content rule says otherwise;
- the encounter may apply a short re-engagement/reset cooldown if needed to stop abuse;
- the character returns to the appropriate authoritative world location/state.

Do **not** delete Character XP, randomly destroy items, or apply punitive durability damage merely because the player retreated.

The normal cost is **lost opportunity + already-spent battle resources + reset/re-entry friction**.

## 26. Tactical Extraction — Retreat Must Be Earned

More dangerous encounters may use `TACTICAL_EXTRACTION`.

Examples:

- reach an extraction tile/edge;
- activate an escape object;
- survive until an extraction route opens;
- remove an immobilizing/containment effect;
- escort the party to an exit.

Successful extraction still resolves as Retreat/loss unless escaping is itself the scenario's victory objective.

This is preferable to an opaque random `42% chance to flee` button because the player can understand and influence the outcome through combat positioning.

## 27. No Voluntary Exit

Some content can intentionally disable retreat, for example:

- selected story duels;
- final boss phases;
- sealed arenas;
- specific Expedition rooms/checkpoints;
- survival sequences;
- narrative situations where escape is mechanically impossible;
- tournament rules.

The UI must state this clearly before or during entry where appropriate.

A disabled Retreat button should explain:

> Retreat is impossible while the arena seal is active.

Do not silently remove the button and make the player wonder whether the interface is broken.

## 28. PvP — Surrender, Not Flee RNG

PvP uses **Surrender / Forfeit**, not a probabilistic Flee action.

### 1v1

A player can normally surrender through a confirmed action.

Result:

- immediate competitive loss;
- opponent receives the legitimate win;
- normal published rating/season consequences of a loss apply;
- no special extra rating punishment merely for using the official surrender control;
- repeated very-early surrender/disconnect abuse may trigger queue/cooldown/behavior protections separately.

### Team PvP

Team modes require a deliberate policy such as:

- team surrender vote after an eligible point/time;
- unanimous/majority rule according to mode;
- individual disconnect/abandon behavior remains separate.

One player must not be able to instantly surrender a 2v2 match for their teammate without the mode explicitly allowing it.

## 29. Disconnect Is Not the Retreat Button

Closing the browser, killing the connection, or timing out must not be a cheaper way to escape consequences.

The server preserves battle state/reconnect grace according to mode rules.

If a player fails to return:

- PvE follows the scenario/session abandonment policy;
- PvP eventually forfeits according to published competitive rules;
- repeat abuse can be detected independently from normal use of the Surrender button.

## 30. Retreat Penalties Are Visible Before Confirmation

The confirmation surface should say exactly what happens.

Example:

```text
RETREAT FROM ENCOUNTER?

This encounter will count as a loss.
You will receive no victory rewards.
Items/resources already spent in battle remain spent.
You will return to Greyfen Crossroads.
This encounter can be challenged again after its normal reset.

[Stay in Battle]    [Retreat]
```

No hidden punishment.

## 31. Event, Expedition and Nation Overrides

Later systems may define additional transparent consequences:

- Expedition threat/attempt state;
- event contribution not awarded;
- nation objective failure;
- boss lockout/attempt rules;
- story branch consequences.

These use versioned scenario/mode rules and are previewed before confirmation where disclosure does not violate story design.

Event Staff cannot invent arbitrary punitive retreat penalties outside the approved typed catalog.

---

# PART VII — PLAYER-FACING BATTLE MENU

## 32. Utility Menu

The battle cockpit should expose a compact utility menu rather than occupying prime command slots with rarely used operations.

Possible contents:

- Controls / Keybinds;
- Combat Log;
- Objective details;
- Accessibility/display options;
- Retreat / Surrender / Abort when allowed;
- Help / Rules summary.

The exit option receives destructive-action styling and confirmation.

Do not place `Retreat` immediately beside `Basic Attack` where a normal combat misclick can cause a loss.

---

# PART VIII — AUTHORING & SERVER REQUIREMENTS

## 33. Scenario Metadata Additions

Battle Scenario definitions should eventually be capable of expressing:

- board dimensions/geometry reference;
- recommended/max participant footprint;
- spawn zones;
- tactical-density validation metadata;
- battle exit policy;
- extraction zones/conditions where used;
- retreat result classification;
- world return target/policy;
- reward/entry-cost treatment;
- PvP surrender policy;
- practice-abort policy.

## 34. Server Authority

- client keybinds never determine legality;
- Retreat/Surrender/Abort is a server command with expected battle version/idempotency safety;
- server verifies exit policy and actor/team authorization;
- server records a distinct terminal result such as `retreated`, `surrendered`, `aborted`, `defeat`, or `victory` where useful;
- rewards/ratings/world transitions consume that authoritative result;
- reconnect cannot duplicate terminal settlement;
- client cannot relabel a defeat as a retreat or a practice abort as a victory.

## 35. AI Awareness

AI should understand exit/extraction objectives only when relevant.

Examples:

- pursue or block an extracting player if scenario rules allow;
- defend an exit zone;
- attempt retreat itself only for authored enemy behavior where fiction/design requires it;
- Recruit practice AI does not surrender merely because its utility score falls behind unless the Tactical Record explicitly teaches that behavior.

---

# PART IX — VALIDATION

## 36. PV-1 Usability Questions

Before Phase 3 deepens the command set, representative testers should be able to:

- move without accidentally spending the Action;
- identify when the Action is Ready vs Spent;
- select Basic Attack without instruction after initial teaching;
- understand why Basic Attack/Guard is disabled;
- choose a legal target;
- read the forecast;
- Confirm intentionally;
- cancel safely;
- understand final facing and change it quickly;
- end a turn without an unnecessary extra-facing ceremony;
- use or locate keybind help;
- understand whether this battle can be retreated from;
- complete a normal duel on more than one meaningful battlefield scale.

## 37. Battlefield Validation

PV-1 should include more than one map shape/size before declaring tactical combat proved.

At minimum, include:

- the Micro training floor for deterministic onboarding;
- one larger Duel/Small Encounter battlefield where terrain, movement and flanking genuinely matter.

Phase 4 then expands the map suite substantially.

## 38. Telemetry / Playtest Signals

Useful signals include:

- time from turn start to first command selection;
- time to first Basic Attack;
- number of cancels before first legal attack;
- unavailable-action reason views;
- repeated clicks on disabled commands;
- end-turn facing changes;
- accidental end-turn/retreat cancellation rate;
- use of keyboard vs pointer/touch;
- keybind remap rate;
- retreat/surrender frequency by mode;
- voluntary second-battle selection.

Do not record raw keystrokes or unnecessary input surveillance.

---

# PART X — DEFINITION OF SUCCESS

This addendum succeeds when:

- the current tiny training floor is understood as a drill, not the permanent combat-map standard;
- normal battlefields scale with scenario needs and participant footprint;
- larger maps create flanking/range/terrain/objective decisions without dead walking time;
- players can understand Move → Action → Facing → End Turn without a manual;
- actions explain why they are unavailable;
- final facing remains strategically meaningful but is not repetitive busywork;
- WASD/Space/Enter/Escape and other defaults make keyboard combat comfortable while remaining safely remappable;
- account-level Controls & Keybinds is a real settings feature;
- standard PvE can offer transparent Retreat where appropriate;
- dangerous/story content can forbid or require tactical extraction;
- PvP surrender is explicit and fair rather than random;
- training can always be aborted cleanly;
- all battle exits remain server-authoritative and cannot bypass rewards, ratings, world-state or anti-abuse rules;
- PV-1 is not allowed to pass while representative players are mainly fighting the interface instead of making tactical decisions.
