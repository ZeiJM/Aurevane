# AUREVANE — Battlefield Interface, Combat Cockpit & Command Deck

**Status:** Authoritative battle-interface specification subordinate to `docs/GAME_MASTER_PLAN.md` and `docs/COMBAT.md`, and complementary to `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/ART_BIBLE.md`, `docs/AUDIO_BIBLE.md`, `docs/COMBAT_AI_TRAINING.md`, and `docs/ROADMAP_PRODUCT_VALIDATION.md`.

**Direction approved:** 2026-08-16.

This document defines how AUREVANE's deep tactical battle state is presented and controlled by the player.

The design is informed by useful abstract patterns seen in other browser RPG interfaces — stable self/opponent context, grouped battle options, explicit target selection, visible initiative, and readable event history — but AUREVANE must not copy another game's layout, styling, text, assets, colors, or implementation. The external reference screenshots are design-study material only and are not production assets.

AUREVANE has a real tactical board. Therefore the battle interface must solve a harder problem than a form-driven browser battle screen: it must preserve the clarity of persistent status and deliberate command selection **without allowing interface chrome to suffocate the battlefield**.

The central rule is:

> **The battlefield is the primary canvas. The command deck is the primary control surface. Everything else exists to help the player read, plan, preview, and commit decisions without losing sight of the board.**

---

## 1. Battle Interface North Star

At almost any moment during a normal turn, a player should be able to answer the following without searching through multiple pages or scrolling the entire screen:

1. Whose turn is it?
2. What can my active character still do this turn?
3. Where can I move?
4. What actions are available and why are others unavailable?
5. What am I currently targeting or inspecting?
6. What will happen if I commit this action, to the extent the rules allow me to know?
7. Who acts next?
8. What objective matters right now?
9. What important statuses, hazards, telegraphs, or reactions should I care about?
10. How do I cancel or confirm safely?

The interface succeeds when the player spends attention on **tactical reasoning**, not on locating controls.

---

## 2. What the Reference Pattern Gets Right

Useful abstract principles worth preserving include:

- a stable place to read the player's combat state;
- a stable place to inspect opponent state;
- battle commands grouped into understandable categories rather than scattered around the page;
- explicit action → target → submit/confirm flow;
- visible initiative/order information;
- readable event history;
- strong separation between information and the final commitment action;
- enough persistent status context that the player does not need to reopen a character sheet every turn.

These ideas are not unique visual designs and can be reinterpreted for AUREVANE.

---

## 3. What AUREVANE Must Improve

A tactical battlefield changes the layout economics.

AUREVANE should avoid problems common to fixed browser battle layouts such as:

- duplicating the same enemy information in multiple permanent panels;
- forcing the player to scroll between the board and the action controls;
- keeping a large battle log permanently visible when it is not needed for the current decision;
- consuming an entire side rail with initiative when a compact timeline can communicate the same information;
- allowing player/enemy stat sheets to become more visually dominant than the battle map;
- presenting dozens of equally weighted buttons;
- putting important confirm/cancel controls below the fold;
- requiring hover to understand an action;
- using disabled buttons without saying **why** they are disabled;
- showing so many overlays that terrain, facing, movement, and unit positions become difficult to read.

The goal is not maximum information on screen. It is **maximum useful information per unit of attention**.

---

## 4. The Three-Layer Information Model

Battle information is divided into three layers.

### Layer A — Always-visible combat essentials

Normally visible during active decision-making:

- battlefield;
- active actor identity;
- active actor HP/MP and relevant temporary resource;
- Movement Budget remaining;
- Action ready/spent state;
- Reaction readiness/state where useful;
- compact status summary;
- turn/initiative timeline;
- objective/round state;
- command deck;
- current targeting/path/area preview;
- confirm/cancel/end-turn controls when relevant.

### Layer B — Selection context

Appears or changes according to what the player selects:

- selected ally/enemy/unit inspector;
- selected terrain/tile inspector;
- status details;
- action description;
- cost/range/cooldown summary;
- legal/illegal target explanation;
- forecast;
- known Reaction risk;
- telegraph/boss mechanic explanation;
- target/path/area consequences.

### Layer C — Deep inspection

Available on demand without permanently stealing board space:

- complete combat log;
- full character/stat sheet;
- exact status glossary;
- detailed Art definition;
- terrain rules;
- public Tactical Record information;
- Battle Review;
- expanded objective rules;
- party communication/history where needed.

Layer C uses drawers, sheets, overlays, inspectors, or dedicated post-battle surfaces rather than occupying the normal battlefield viewport continuously.

---

## 5. Desktop Battle Cockpit

On a large desktop, the preferred conceptual structure is:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ OBJECTIVE / ROUND           INITIATIVE TIMELINE              TIMER / STATE │
├───────────────┬───────────────────────────────────────┬────────────────────┤
│ PARTY / SELF  │                                       │ SELECTED CONTEXT   │
│ COMBAT RAIL   │              BATTLEFIELD              │ INSPECTOR          │
│               │                                       │                    │
│ compact HP/MP │     movement / targeting / terrain    │ unit or tile       │
│ statuses      │          / facing / objects           │ forecast/status    │
│ actor state   │                                       │                    │
├───────────────┴───────────────────────────────────────┴────────────────────┤
│ EVENT TICKER / TURN ECONOMY TRACKER                                        │
├────────────────────────────────────────────────────────────────────────────┤
│                              COMMAND DECK                                  │
│ Basics | Current | Legacy | Movement | Signature | Items | Confirm/Cancel │
└────────────────────────────────────────────────────────────────────────────┘
```

This is a composition rule, not a demand for fixed pixel dimensions or a visual copy of any reference game.

The center must remain visually dominant.

---

## 6. Battlefield-First Space Allocation

The board receives first claim on useful viewport space.

Guidelines:

- do not design the board as a card inside a card inside a page;
- do not require page-level vertical scrolling to move between board and command controls during an ordinary turn;
- side rails collapse before the board becomes unusably small;
- deep panels become drawers/overlays before they permanently compress the board;
- on common laptop heights, reduce decorative padding and secondary text before reducing tactical legibility;
- the board camera may zoom/pan according to map needs, but interaction targets remain grid-snapped and readable;
- opening a utility panel such as audio/help must not unexpectedly shift the board.

The exact renderer and dimensions remain an implementation decision, but the battlefield should feel like the **game**, not like one widget among many.

---

## 7. Left Combat Rail — Self / Party State

The useful idea of keeping the player's state persistently visible is retained, but condensed.

For solo combat, the left rail can show the active player character and important summons/companions when relevant.

For co-op, it becomes the party combat rail.

Each compact party card may show:

- portrait/icon;
- name;
- active-turn highlight;
- HP;
- MP;
- relevant Discipline resource when it matters;
- a few high-priority status icons;
- defeat/downed state;
- connection/turn-control state in co-op where needed.

Do **not** permanently show every attribute, resistance, currency, biography field, or out-of-combat progression value during battle.

Those belong to deeper inspection.

### Active actor emphasis

The currently controlled actor should be unmistakable through multiple cues such as:

- frame treatment;
- icon/marker;
- board selection ring;
- textual active-turn label where appropriate;
- subtle audio cue.

Do not rely on color alone.

---

## 8. Right Context Inspector — Not a Permanent Enemy Sheet

AUREVANE often has multiple enemies, allies, summons, battle objects, zones, and terrain states. Therefore a fixed panel dedicated to one enemy is too rigid.

The right-side contextual inspector changes according to selection.

### When a unit is selected

It may show information the player is entitled to know:

- portrait/icon;
- name/type/team;
- HP and MP where public/known;
- facing;
- important visible statuses and durations;
- public resources;
- public armor/ward or relevant defensive information where the combat rules expose it;
- known resistances/traits according to discovery rules;
- current telegraph/channel state;
- selected target relationship;
- target legality explanation;
- relevant known Reaction risk.

### When a tile is selected

The same inspector becomes a terrain/objective panel:

- terrain type;
- elevation;
- movement cost for the active actor;
- hazard/zone state;
- cover/LoS consequences;
- objective relationship;
- battle object state;
- relevant transformation interactions the player is entitled to know.

### When nothing is selected

It can collapse to a concise objective/tactical summary instead of remaining a blank large panel.

This removes duplicate information and makes the right rail useful in every kind of battle.

---

## 9. Initiative Timeline — Compact, Persistent, Actionable

The reference value of visible initiative is retained, but converted into a compact horizontal timeline near the top of the battlefield.

The timeline should show the near-term order using unit portraits/icons and clear team distinction.

It should communicate:

- current actor;
- next several actors;
- delayed/accelerated actors;
- summons entering/leaving order;
- extra boss actions;
- incapacitated/removed actors;
- known scheduled effects when the combat rules expose them.

Hover/focus/tap can reveal exact names/status, but required turn-order understanding must not depend on hover.

On narrow screens, show the current actor plus the next few entries and allow horizontal disclosure rather than shrinking every icon to illegibility.

---

## 10. Objective / Round Strip

A slim top strip communicates the battle's strategic context without becoming a giant header.

It may show:

- scenario/objective name;
- round;
- objective progress;
- capture/escort/survival state;
- boss phase;
- competitive timer where applicable;
- connection/reconnect state when needed.

Long narrative prose belongs before/after battle or in a contextual story panel, not permanently above every tactical turn.

---

## 11. The Command Deck

The strongest reference idea is the stable **battle options area**. AUREVANE evolves that into a persistent bottom **Command Deck**.

The deck is anchored to the battle viewport so ordinary command selection never requires scrolling away from the board.

It visually groups actions according to the combat system rather than flattening every command into one list.

Recommended categories:

```text
BASICS
  Basic Attack
  Guard
  Interact when available
  Wait / End Turn

CURRENT
  4 equipped Current Discipline Arts

LEGACY
  2 equipped Legacy Arts

MOVEMENT
  equipped Movement Art

SIGNATURE
  Soulmark Signature where present
  Confluence Art where present
  Current Ultimate where unlocked

ITEMS
  configured combat items when the mode permits them
```

The exact desktop presentation can use slots, icon rows, tabs, or a hybrid. The category identity must remain understandable.

---

## 12. Fast Access Without Hotbar Clutter

AUREVANE has enough actions to require deliberate grouping, but not so many that the player should navigate nested menus every turn.

Preferred desktop behavior:

- the six ordinary equipped Arts are one-click/one-key reachable;
- Basics remain quickly accessible;
- Movement and Signature actions remain visually distinct;
- unavailable actions remain visible when useful for planning, but explain the blocker;
- rare/contextual actions appear only when relevant rather than occupying permanent prime space;
- category switching never hides the fact that a different action group contains a currently important ready ability.

The interface should avoid the two extremes of:

- a giant vertical form requiring multiple clicks for every normal strike; and
- an MMO-style wall of twenty-five tiny equal-priority icons.

---

## 13. Turn Economy Tracker Integration

`docs/COMBAT.md` already requires a Turn Economy Tracker. It belongs immediately adjacent to the command deck because it answers the question **"what can I still spend this turn?"**

At minimum, show as relevant:

- Movement remaining / total;
- Action Ready or Action Spent;
- Reaction state when useful;
- MP;
- temporary Discipline resource;
- cooldown/charge state for the selected action;
- combat-item quantity/charge when an item is selected.

When an action is highlighted, the tracker previews its cost:

```text
Movement: 4 / 6  →  2 / 6 after path
Action: READY     →  SPENT
MP: 42 / 60       →  27 / 60
Reaction: READY
```

This preview is informational. The server remains authoritative.

---

## 14. Action Selection State Machine

The command deck should make a turn feel like a controlled planning sequence rather than a collection of unrelated clicks.

Conceptually:

```text
NEUTRAL / INSPECT
  ↓ choose action
ACTION SELECTED
  ↓ choose target / destination / direction
AIM / TARGET
  ↓ preview
FORECAST READY
  ↓ explicit commit
PENDING SERVER ACCEPTANCE
  ↓ authoritative events
RESOLUTION
  ↓
RETURN TO DECISION STATE OR NEXT ACTOR
```

Multi-stage Arts add finite steps:

```text
Art
→ entrance tile
→ exit tile
→ forecast
→ confirm
```

A small breadcrumb/step indicator should make multi-stage targeting understandable.

`Escape`/Cancel moves backward before commitment where safe.

After server commitment there is no fake client undo.

---

## 15. Inspect Mode vs Target Mode

One major source of tactical-interface mistakes is ambiguity about what a board click means.

AUREVANE separates:

### Inspect mode

No active action selected.

Click/tap a unit or tile to inspect it.

### Target mode

An action is selected.

Click/tap a legal unit/tile to select the action target.

The interface should visibly indicate when the player is in Target mode through:

- action name;
- target instruction;
- valid-target highlighting;
- cursor/touch-state change where appropriate;
- Cancel/Back availability.

The player should never wonder whether clicking a unit will merely inspect it or immediately spend a turn.

---

## 16. Explicit Commit / Confirm Rule

AUREVANE's tactical actions can have meaningful irreversible consequences. Normal substantive actions should therefore use an explicit commit step after target selection.

The compact commit summary can look conceptually like:

```text
RIFT EDGE
Target: Ashbound Sentinel
Destination: (8, 4)
MP: 15
Expected: 44–51 physical damage
Also: blink 1 tile; Exposed 1 turn
Known risk: enemy Reaction may trigger

[Cancel]                      [CONFIRM]
```

Not every harmless camera/inspection action needs confirmation.

Repeated low-risk actions may eventually support carefully tested faster input modes in PvE, but the default interface should protect players from accidental major commitments.

---

## 17. Forecast Placement

`docs/COMBAT.md` already defines forecast information. The battle interface should make forecast part of the decision loop, not a detached tooltip.

Forecast can use a combination of:

- board overlays;
- compact target inspector content;
- command-deck summary;
- projected path/area visuals.

Possible fields include:

- hit chance;
- damage/healing range;
- crit possibility;
- statuses;
- displacement endpoint;
- movement remaining;
- target facing change;
- terrain/zone change;
- objective effect;
- known Reaction risk;
- MP/resource/cooldown outcome.

Do not duplicate every forecast field in three places. Use the board for spatial consequences, the inspector for target context, and the command deck for the final concise commitment summary.

---

## 18. Board Overlay Priority

Tactical overlays must remain readable when multiple systems interact.

Potential overlays include:

- reachable movement tiles;
- selected path;
- targeting range;
- area shape;
- friendly-fire exposure;
- displacement path/end tile;
- height restriction;
- line of sight;
- hazard/zone;
- objective area;
- telegraphed attack;
- Reaction threat area.

Do not show all possible overlays at full intensity simultaneously.

Use a priority model based on the player's current task.

Example:

### Moving

Primary: reachable tiles + path + movement cost.

Secondary: hazards/Reaction threats.

Targeting range is subdued or hidden.

### Targeting an Art

Primary: legal targets + area shape + affected units.

Secondary: movement/terrain consequences relevant to the action.

Unrelated move-range shading is reduced.

### Inspecting

Primary: selected tile/unit and contextual relationships.

Action overlays are absent.

Patterns, outlines, icons, labels, and contrast must supplement color so the system remains understandable with color-vision differences.

---

## 19. Status Presentation

Statuses need enough persistence to support planning without turning every unit into a stack of tiny unreadable badges.

### On-board unit treatment

Show only high-priority immediate information, for example:

- health state;
- active selection/turn marker;
- a small number of priority status icons;
- telegraph/channel marker;
- facing.

If many statuses exist, show a bounded subset plus a `+N` indicator.

### Inspector / combat rail

Show fuller status information:

- icon;
- name;
- remaining duration/stacks;
- positive/negative/neutral category;
- concise effect;
- source where useful.

Duration language must match authoritative timing rules.

---

## 20. Action Availability States

An action button/slot can represent states such as:

```text
READY
READY_WITH_CONDITION
COOLDOWN
NO_CHARGES
INSUFFICIENT_MP
INSUFFICIENT_DISCIPLINE_RESOURCE
WRONG_WEAPON
INVALID_CURRENT_STATE
NO_LEGAL_TARGET
ONCE_PER_BATTLE_SPENT
MODE_DISABLED
```

Do not merely gray out unavailable actions.

A focus/tap/inspect state should explain the blocker in useful language:

> Need 8 more MP.

> Requires a Bleeding target.

> Movement Art already used this turn.

> No legal landing tile.

> Disabled by this PvP ruleset.

This makes unavailable actions educational rather than frustrating.

---

## 21. Event Ticker + Full Combat Log Drawer

The permanent large combat log panel from form-driven battle screens does not justify its space in a tactical board interface.

AUREVANE instead uses two levels.

### Event ticker

A compact, transiently updated line/stack near the board or command deck showing the latest important authoritative events:

```text
Ravager used Breakline → 38 damage → Bastion became Exposed
Stormsinger's Reaction triggered: Static Rebuke
North Seal: 2 / 3 captured
```

### Combat Log drawer

A deeper on-demand history containing:

- round/turn;
- action;
- target;
- hit/miss/crit;
- damage/healing;
- statuses;
- resource changes;
- movement/displacement;
- terrain changes;
- Reactions;
- defeats;
- objectives.

The log uses structured authoritative battle events and supports keyboard/screen-reader access.

A player who wants to study exactly what happened can do so without everyone paying the screen-space cost every turn.

---

## 22. Boss and Telegraph Context

Boss battles need stronger persistent context, but should still protect the board.

The inspector/top strip can expose:

- boss phase;
- visible break/stagger state;
- known mechanic counters;
- active telegraph countdown;
- target zones;
- channel/interruption state;
- multiple scheduled boss actions.

Telegraphs should be represented spatially on the board first. Text supplements the board rather than replacing it.

---

## 23. Current vs Legacy Visual Language

AUREVANE's signature build system should be visible in the command deck.

Current and Legacy Arts need distinct but harmonious source markers.

Requirements:

- source is recognizable without opening a tooltip;
- source distinction does not rely on color alone;
- the six ordinary Arts still feel like one coherent build rather than two unrelated menus;
- a Confluence Art visually reads as a result of the pairing, not merely another Current or Legacy slot;
- Soulmark and Ultimate have their own recognizable marks;
- action iconography follows the Art Bible and stable asset IDs.

The interface should help a player *feel* the build relationship every turn.

---

## 24. Confluence Preview Trial UI

`docs/PRODUCT_STRATEGY_AND_COMMERCIAL_VALIDATION.md` defines an early controlled Confluence Preview Trial.

Its interface should use the real battle cockpit, not a fake tutorial-only minigame.

The temporary Legacy/Confluence availability should be clearly framed as a preview/trial state so players understand:

- why they temporarily have the extra abilities;
- which Current + Legacy pair is being demonstrated;
- what the Confluence changes;
- that permanent Legacy use still requires real Mastery later.

The goal is to teach the future fantasy without creating a second combat UI that must later be thrown away.

---

## 25. Co-op Adaptation

A party of up to three changes the information needs but not the core cockpit.

Additions may include:

- party combat rail with all three characters;
- clear controlled-character/active-turn state;
- teammate connection/reconnect state;
- contextual ping/attention markers where approved;
- compact party objective context;
- clear ownership of summons/objects where relevant.

Do not add a giant permanent chat pane that compresses the battlefield.

Party communication can use a collapsible/transient panel and context-aware pings if implemented.

A player waiting for a teammate's turn should still be able to inspect the battlefield and plan without being able to submit unauthorized commands.

---

## 26. PvP Adaptation

PvP uses the same cockpit with stricter information and timing rules.

Requirements:

- server-owned visible decision timer;
- warning state before timeout;
- public information only in the opponent inspector;
- hidden loadout/Reaction information remains hidden until the game rules reveal it;
- equivalent animation/rules timing between opponents;
- selected premium cosmetics/VFX cannot obscure tactical state;
- disconnect/reconnect state is clearly communicated;
- competitive confirmation flow is fast enough for the configured turn timer;
- no hover-only information advantage;
- normalized/reduced-effects options preserve competitive readability.

The interface must never leak server-known hidden opponent state merely because the inspector component can display that field for PvE enemies.

---

## 27. Laptop Density Mode

A common 1366×768 laptop is a first-class target.

At constrained height/width:

- side rails become denser before the board shrinks excessively;
- right inspector may become narrower or partially collapsible;
- initiative remains a compact strip;
- command deck uses reduced padding and concise labels;
- deep descriptions open in overlays/drawers;
- event ticker stays compact;
- decorative battle framing reduces before tactical controls do;
- no ordinary turn requires page-level scrolling to reach Confirm/Cancel/End Turn.

The laptop experience is not simply the desktop layout scaled down uniformly.

---

## 28. Phone Portrait Mode

Phone combat requires a different composition while preserving the same interaction model.

Conceptually:

```text
┌──────────────────────────────┐
│ round / objective / timeline │
├──────────────────────────────┤
│                              │
│          BATTLEFIELD         │
│       pan / zoom / tap       │
│                              │
├──────────────────────────────┤
│ selected actor / target chip │
├──────────────────────────────┤
│ COMMAND SHEET / TURN TRACKER │
│      sticky confirm/cancel   │
└──────────────────────────────┘
```

Rules:

- the battlefield remains continuously visible during ordinary action selection;
- left/right rails become drawers/sheets rather than permanent columns;
- the command deck becomes a touch-friendly bottom sheet/tray;
- the collapsed tray exposes essential categories and turn economy;
- selecting an action can expand the tray for details without covering the whole board;
- Confirm/Cancel remain reachable above safe-area/browser chrome;
- tap targets are comfortably sized;
- pinch/pan/zoom must not accidentally commit a tile target;
- board targeting snaps clearly to grid cells/units;
- a dedicated inspect affordance exists so mobile users do not depend on hover;
- back/cancel behavior is deterministic through multistage targeting.

Phone design should be tested on physical-device-like interaction assumptions, not only desktop emulation.

---

## 29. Phone Landscape / Tablet

Landscape phones and tablets can use a hybrid cockpit:

- board remains central;
- one compact side inspector may remain persistent;
- party rail can become a small vertical strip;
- command deck remains bottom-anchored;
- timeline stays horizontal.

The interface should respond to available space through container/layout rules rather than device-name sniffing.

---

## 30. Keyboard and Pointer Efficiency

The battle interface should support efficient mouse/keyboard play without making keyboard shortcuts mandatory.

Baseline keyboard behaviors should include where appropriate:

- `Escape` — cancel/back one targeting step or close transient panel;
- `Enter`/approved confirm key — confirm when focus/state makes the action unambiguous;
- keyboard focus access to all action slots and essential controls;
- visible focus treatment;
- logical tab order;
- shortcuts for ordinary equipped Arts can be added when they do not conflict with accessibility/input fields.

If numeric/action hotkeys are introduced, they are documented and ideally configurable later rather than hidden assumptions.

Camera/navigation keyboard controls must not steal typing focus from chat/help/accessibility fields.

---

## 31. Touch Safety

Touch combat must distinguish:

- pan gesture;
- zoom gesture;
- inspect tap;
- target tap;
- command selection;
- confirm.

A pan beginning on a tile must not commit that tile as a target.

High-consequence actions retain explicit confirmation.

Small status icons or timeline entries must expand to readable touch targets rather than requiring precision tapping.

---

## 32. Accessibility

Combat state cannot depend on color, sound, animation, or fine pointer precision alone.

Requirements include:

- semantic labels for action buttons and statuses;
- keyboard access;
- visible focus;
- non-color markers for teams/source/status priority;
- reduced-motion support;
- camera-shake control;
- separate combat audio channels through the existing Audio Director;
- important audio cues mirrored visually;
- important visual telegraphs represented in accessible text/inspection where practical;
- screen-reader-friendly battle log and objective/status summaries;
- controls that remain usable at browser zoom/text scaling targets defined by project accessibility policy.

A fully spatial tactical board may not be perfectly representable through a screen reader, but surrounding commands, state, logs, objectives, and useful summaries must still be exposed deliberately rather than becoming unlabeled canvas noise.

---

## 33. Audio UX

The command deck and combat cockpit may use restrained UI audio:

- action selected;
- action unavailable/error;
- target locked;
- confirm;
- cancel/back;
- turn begins;
- timer warning;
- objective change;
- Reaction trigger;
- status/telegraph warning where useful.

These cues complement, not compete with, combat SFX and music.

Avoid a constant chorus of menu sounds during rapid board inspection.

All combat remains playable muted.

---

## 34. Animation and Input Responsiveness

The player should receive immediate local feedback when selecting, hovering/focusing, or previewing an action even though the final result remains server-authoritative.

When a command is committed:

- Confirm becomes pending/disabled against duplicate submission;
- the selected command is visibly acknowledged;
- the client does not fabricate the authoritative result;
- accepted server events drive final resolution;
- rejected/stale commands refresh safely and explain what changed.

Animations must not block access to required information longer than necessary.

After impact, the interface restores board readability quickly for the next decision.

---

## 35. Stale-State / Server-Rejection UX

Because battles are authoritative and versioned, a command may be rejected if the state changed.

The interface should handle this as a normal multiplayer condition rather than a generic fatal error.

Possible flow:

1. server rejects stale `expected_battle_version`;
2. client requests/receives current snapshot;
3. board/timeline/status refresh;
4. if the selected action/target is still legal, the client may reconstruct the preview;
5. otherwise selection safely returns to an earlier decision state;
6. player sees a concise message such as:

> Battle state changed. Your preview has been refreshed.

Never silently submit a different target/action than the player confirmed.

---

## 36. Reconnect UX

On reconnect, restore:

- battle identity;
- current authoritative snapshot;
- active actor/ownership;
- timer state;
- initiative timeline;
- recent important events;
- objective state;
- board camera reasonably;
- command deck state safely.

A pre-disconnect uncommitted preview is disposable unless it can be reconstructed confidently from the current state.

Do not pretend an uncommitted client-side selection survived if the battle changed.

---

## 37. Information-Density Guardrails

The battle cockpit should resist feature creep.

Before adding any permanent UI element, ask:

1. Does the player need this for most turns?
2. Does it affect the current decision?
3. Can it be represented by a compact indicator?
4. Can it become contextual instead of permanent?
5. Can it live in the inspector or a drawer?
6. Does it duplicate information already visible elsewhere?
7. What board space does it cost on a 1366×768 laptop and a phone?

If a new system requires a new permanent panel every time, the architecture has failed.

---

## 38. Anti-Duplication Rule

Each important fact should have one primary home.

Examples:

- HP/MP for the active actor: combat rail / actor summary;
- turn order: timeline;
- selected target detailed state: context inspector;
- action choice: command deck;
- spatial consequence: board overlay;
- final action summary: commit area;
- history: log drawer;
- objective: top objective strip;
- full build/stat detail: deep inspection.

A small repeated cue is allowed when it improves safety, but large duplicated panels are not.

---

## 39. Combat UI Data Boundary

The interface consumes structured authoritative battle state and content rather than maintaining a second hand-written rules model.

The UI should receive enough structured data to represent:

- units;
- teams;
- public/known stats;
- resources;
- statuses;
- cooldowns/charges;
- turn economy;
- initiative;
- map/terrain/object state;
- objectives;
- legal action definitions known to the actor;
- target/path/shape preview rules;
- visibility/spoiler/public-information boundaries;
- battle version;
- authoritative event stream.

The client may calculate display previews from server-provided state/rules where approved, but server validation remains final.

Do not hard-code combat numbers into React labels that can drift from `docs/COMBAT.md` content definitions.

---

## 40. UI Component Boundaries

Likely reusable conceptual components include:

```text
BattleViewport
BattleTopStrip
InitiativeTimeline
CombatPartyRail
BattlefieldRenderer
ContextInspector
TurnEconomyTracker
CommandDeck
ActionSlot
ActionGroup
ActionDetail
TargetingStepIndicator
ForecastSummary
CommitControls
EventTicker
CombatLogDrawer
StatusList
TerrainInspector
ObjectiveSummary
ReconnectBanner
```

These names are illustrative, not mandatory file names.

Avoid one giant `BattleScreen.tsx` owning authoritative combat rules, rendering, timers, audio, targeting, networking, and every panel.

---

## 41. Responsive State Is Presentation State

Desktop rails, laptop compact rails, and phone drawers are different presentations of the same battle state.

Do not maintain separate gameplay logic for mobile combat.

A responsive rearrangement must not change:

- action legality;
- information entitlement;
- forecast rules;
- server command shape;
- timers;
- status values;
- target selection semantics.

Only presentation and interaction ergonomics change.

---

## 42. Performance Principles

Combat UI performance is part of correctness.

Requirements:

- pointer/touch selection should feel immediate;
- camera movement should remain smooth on representative hardware;
- changing an HP value should not unnecessarily rerender the entire world UI;
- long combat logs should not create unbounded DOM/render cost;
- hidden drawers should not run expensive work continuously;
- particle/VFX density must respect device/performance settings;
- responsive images and battlefield assets use appropriate runtime derivatives;
- the battle renderer technology should be chosen from measured needs rather than fashion;
- low-performance mode may reduce cosmetic complexity but must preserve tactical information.

The project should instrument real frame/input/network behavior during the tactical-combat proof gate rather than assuming a browser can handle any presentation we design.

---

## 43. Telemetry for Interface Quality

Product telemetry should answer real combat-interface questions without becoming surveillance.

Useful aggregate events/measurements may include:

- first action selected;
- first legal target selected;
- action cancelled before commit;
- server-rejected command reason class;
- targeting step restarted;
- combat log opened;
- inspector opened/collapsed;
- action unavailable reason viewed;
- time to first confident/committed action;
- battle abandonment;
- repeated mis-target/cancel patterns;
- phone/desktop viewport category;
- performance/error class.

Do not log unnecessary raw pointer movement or sensitive player information.

Telemetry is used to discover friction, not to punish thoughtful players for taking time.

---

## 44. PV-1 Combat Proof Interface Questions

During the Tactical Combat Proof Gate, test whether players can:

- identify the active actor quickly;
- understand Movement Budget + one Action;
- find the command deck without instruction;
- distinguish inspect mode from target mode;
- understand valid versus invalid targets;
- predict the result of a basic action from the forecast;
- cancel safely;
- commit intentionally;
- read initiative;
- identify important statuses/terrain;
- complete a battle without losing track of the board because of panels;
- voluntarily choose another fight because the decisions were interesting rather than because the UI was merely novel.

Warning signs include:

- players repeatedly clicking the wrong unit because inspect/target modes are ambiguous;
- players scrolling to find Confirm;
- players missing that an action is unavailable because the button simply looks disabled;
- players ignoring terrain because overlays are unreadable;
- players opening the full log constantly because the immediate consequence feedback is insufficient;
- players overlooking initiative because it is buried;
- the board occupying so little laptop/phone space that tactics become tedious.

These failures are interface/product failures, not reasons to add more combat content.

---

## 45. Visual Identity

The battle cockpit should feel unmistakably AUREVANE while remaining restrained enough for repeated long sessions.

Use the Art Bible for:

- frame language;
- typography;
- iconography;
- Current/Legacy/Soulmark/Confluence source marks;
- team and status treatment;
- terrain readability;
- selected/hover/focus states;
- panel depth;
- signature action emphasis.

Avoid turning the interface into generic beige fantasy forms, generic SaaS cards, or excessive glowing sci-fi HUD chrome.

The board and the world art provide spectacle. The interface provides clarity and identity.

---

## 46. Media Requirements

Battle interface implementation should generate structured media requests for missing assets such as:

- action-category/source icons;
- status icon families;
- turn marker;
- target/selection markers;
- objective markers;
- timeline frames;
- Current/Legacy/Confluence/Soulmark/Ultimate source marks;
- command-deck states;
- targeting overlays/textures where image assets are actually needed;
- battle UI SFX.

Do not copy the external reference screenshot styling or import its visual assets.

Where CSS/vector treatment is more appropriate than a raster asset, do not create media solely to satisfy a request count.

---

## 47. Testing Matrix

Every substantial battle-interface ticket should use the smallest relevant subset of:

### Desktop/laptop

- 1366×768;
- 1440×900+;
- no page-level horizontal overflow;
- board remains meaningfully usable;
- command deck/confirm controls visible;
- rails/inspector do not force ordinary turn scrolling.

### Phone

- approximately 360–412 CSS px wide;
- modern portrait height;
- safe-area handling;
- board pan/zoom;
- inspect/target distinction;
- bottom command sheet;
- touch target size;
- no accidental target commit during pan/zoom;
- multi-stage Back/Cancel behavior.

### Input/accessibility

- keyboard focus;
- Escape cancel/dismiss;
- Enter/confirm behavior where enabled;
- no hover-only required information;
- reduced motion;
- muted audio;
- color-independent team/status/target cues.

### Gameplay states

- solo;
- party of three when available;
- multiple enemies;
- summons;
- many statuses;
- boss telegraph;
- terrain/objective-heavy map;
- long initiative order;
- action with multistage targeting;
- no legal targets;
- insufficient resource;
- stale version rejection;
- reconnect;
- PvP timer when available.

---

## 48. Definition of Success

The AUREVANE battle interface succeeds when:

- the battlefield is always the dominant tactical object;
- the player can act without scrolling between board and commands;
- self/party state remains readable without becoming a full character sheet;
- selected enemy/unit/tile information is available without duplicating permanent panels;
- initiative is continuously readable in compact form;
- the command deck makes the equipped build immediately understandable;
- Current, Legacy, Movement, Soulmark, Confluence, Ultimate, Basics, and Items remain organized rather than flattened;
- Movement Budget + Action state is obvious every turn;
- action selection, targeting, forecast, and commitment form one coherent flow;
- unavailable actions explain themselves;
- the full combat log is available without permanently consuming the battlefield;
- desktop, laptop, tablet, and phone are deliberately composed rather than merely scaled;
- no required combat information depends solely on hover, color, sound, or animation;
- the server remains authoritative while local previews feel responsive;
- reconnect/stale-state handling does not cause accidental commands;
- the interface supports the tactical-combat proof gate rather than hiding weak combat under elaborate decoration;
- long combat sessions feel efficient, legible, and game-like rather than like repeatedly filling out a web form.

The desired player feeling is:

> **I can see the field, I understand my options, I know what I am risking, and I can make the move I intended.**
