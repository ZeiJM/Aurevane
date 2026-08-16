# AUREVANE — Battle Interface Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` for battle-interface implementation sequence.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/COMBAT.md` defines combat rules. `docs/BATTLE_INTERFACE.md` defines the authoritative battle-interface direction. This document defines **when** that interface work enters the implementation roadmap without pulling future combat systems forward prematurely.

**Direction approved:** 2026-08-16.

The battle interface is not a late cosmetic skin over combat. It is part of proving whether combat is understandable and enjoyable. However, the complete final cockpit must still be built incrementally alongside the combat capabilities that justify it.

The roadmap rule is:

> **Build the smallest battle cockpit that makes the current tactical slice excellent, then extend the same cockpit as Current/Legacy buildcraft, co-op, Expeditions, PvP, and live operations actually arrive.**

Do not build fake future panels for systems that do not yet exist.

---

## 1. Phase 1 — Preserve the Boundary

Phase 1 remains Character Foundation.

Do not implement the battle board, command deck, initiative timeline, targeting overlays, or combat inspector during Phase 1 merely because their final design is now known.

Phase 1 should preserve only the boundaries it already needs for later combat:

- stable character identity;
- authoritative attributes/derived stats;
- item/equipment identity where current scope requires it;
- responsive design primitives;
- media/audio runtime;
- structured server error/loading/reconnect patterns;
- telemetry conventions that can later accept battle events.

No Phase 1 ticket becomes a hidden combat-UI ticket.

---

## 2. Phase 2 — Combat Cockpit Foundation

Phase 2 is where the first real battle interface is implemented because Phase 2 must prove the tactical combat core.

The Phase 2 interface scope should include the **minimum complete battlefield-first cockpit** required by the tactical vertical slice.

### Required Phase 2 battle-interface capabilities

- central battlefield as the dominant viewport;
- slim objective/round strip;
- compact initiative timeline;
- active actor/self combat summary;
- selected unit/tile contextual inspector;
- persistent bottom Command Deck;
- Basics plus the current vertical-slice actions;
- Turn Economy Tracker for Movement Budget + Action + current relevant resources;
- Inspect mode versus Target mode distinction;
- valid/invalid movement and target highlighting;
- path preview;
- target shape/area preview for implemented shapes;
- selected-action cost/range/cooldown summary;
- forecast for the information implemented by the vertical slice;
- explicit Cancel/Back/Confirm flow;
- concise event ticker;
- on-demand Combat Log drawer;
- End Turn flow;
- disabled/unavailable action explanations;
- server-pending command state;
- stale-version rejection recovery;
- battle reconnect presentation;
- responsive desktop/laptop/phone composition;
- keyboard/touch/accessibility baseline;
- reduced-motion and muted-audio behavior.

### Deliberately out of scope in early Phase 2 unless the slice actually uses it

- complete Current + Legacy six-Art presentation;
- Soulmark Signature slot;
- Confluence Art slot;
- Ultimate slot;
- co-op party communication;
- ranked PvP timer treatment;
- full boss-phase UI if no test boss requires it;
- complete item tray if combat items are not in the current slice;
- full Battle Review;
- spectator mode;
- giant Combat Log analytics tools;
- final art/audio polish.

### Phase 2 interface gate

A representative tester must be able to:

1. identify the active actor;
2. understand available movement;
3. find and choose an action;
4. understand why an unavailable action cannot be used;
5. inspect a target/tile;
6. select a legal target;
7. understand the important forecast;
8. cancel safely;
9. commit intentionally;
10. follow initiative and objective state;
11. finish a battle without page-level scrolling between battlefield and required controls.

This is part of PV-1, not merely a visual acceptance check.

---

## 3. PV-1 — Tactical Combat Proof Integration

`docs/ROADMAP_PRODUCT_VALIDATION.md` defines the Tactical Combat Proof Gate.

PV-1 playtesting must explicitly evaluate the battle cockpit because poor interface clarity can disguise or destroy otherwise-good tactics.

Add the following observations to the PV-1 report where implemented:

- time to first valid committed action;
- whether players distinguish inspect mode from target mode;
- repeated target-selection mistakes;
- action cancellation/restart patterns;
- whether players understand Movement Budget + one Action;
- whether initiative is noticed and used in decisions;
- whether terrain/height/status overlays are readable;
- whether players can state what Confirm will do before pressing it;
- whether players need to scroll or hunt for required combat controls;
- whether the right inspector helps or becomes clutter;
- whether the event ticker makes consequences clear without requiring the full log;
- board readability on 1366×768 and representative phone widths;
- mobile pan/zoom versus target-selection errors;
- interaction/performance problems that make tactical planning feel sluggish.

A weak cockpit should be iterated before increasing combat content volume.

Do not conclude that combat itself is boring until major interface confusion has been separated from actual tactical dissatisfaction.

Conversely, do not hide shallow combat behind a flashy cockpit.

---

## 4. Phase 3 — Signature Buildcraft Interface

Phase 3 introduces Legacy Disciplines, borrowed Arts, Traits/Reactions/Movement Arts, Confluences, and Soulmarks.

Extend the existing Command Deck rather than replacing it.

### Phase 3 additions

- full six ordinary equipped Art presentation: 4 Current + 2 Legacy;
- clear non-color-only Current versus Legacy source marks;
- dedicated Movement Art access;
- Reaction state in the Turn Economy/actor context where useful;
- Soulmark Signature presentation where the released Soulmark provides one;
- Confluence identity presentation;
- Confluence Art slot where the pairing provides one;
- selected build/source summary accessible during inspection;
- source-aware action details/tooltips;
- status/resource indicators required by released Disciplines;
- the real cockpit implementation of the early **Confluence Preview Trial** defined by product strategy.

### Phase 3 UI rule

Do not redesign the entire Command Deck for every Discipline.

Discipline identity comes from:

- action content;
- icons;
- source marks;
- temporary resources;
- targeting/board behavior;
- VFX/SFX;
- Confluences;

—not from creating a bespoke navigation system for each class.

### PV-2 integration

The AUREVANE Identity / Buildcraft Gate should test whether players can visually understand:

- which Arts are Current;
- which are Legacy;
- what the active Confluence is doing;
- what the Soulmark contributes;
- what their Movement Art changes;
- how build changes alter the options they see in battle.

Players should be discussing combinations, not asking which menu contains their build.

---

## 5. Phase 4 — Discipline Roster Scaling

As the playable Discipline roster grows, the battle UI must scale by **data and reusable presentation**, not by copied components.

For each released Discipline, validate:

- action icons/source metadata complete;
- temporary resource presentation fits the existing Turn Economy Tracker pattern;
- unique targeting pattern renders through shared targeting UI;
- statuses use the shared status presentation system;
- Reactions/Movement Arts/signature actions fit existing command groups;
- no Discipline requires a permanent bespoke side panel without a genuine reusable design reason;
- action-name/description lengths remain readable on supported viewports;
- AI-only actions do not leak into player command menus;
- unavailable-action reasons are generated from authoritative requirements rather than handwritten duplicate logic.

Roster expansion should not progressively turn the cockpit into a cluttered exception map.

---

## 6. Phase 5 — World / Encounter Context

When battles are reached from a living world, integrate context without converting combat into a story page.

Add as required:

- location/scenario identity in the slim top strip;
- objective context from quests/events;
- world-linked Battle Scene art/ambience;
- weather/environment state;
- story/event variants;
- encounter-specific help only when needed;
- post-battle return context.

Long narrative introductions should transition cleanly into combat and then release screen space to the battlefield.

---

## 7. Phase 6 — Party & Co-op Interface

When parties and co-op battles become real, promote the solo self rail into the **Party Combat Rail**.

### Required co-op additions

- up to three party member compact combat cards;
- active-turn/control owner indicator;
- HP/MP/relevant resource summaries;
- important statuses;
- connection/reconnect state;
- teammate defeat/downed state;
- waiting-for-teammate state;
- spectator/inspect-only interaction while another player owns the turn;
- party-relevant objective state;
- contextual ping/attention marker only if approved by the co-op design.

### Co-op screen-space rule

Do not add a permanently open chat wall beside the battlefield.

Chat/communication uses a collapsible/transient surface so the board remains primary.

### PV-4 integration

The Co-op / Expedition gate should measure whether the interface makes collaboration easier:

- players can see teammate health/status without opening sheets;
- players understand whose turn/control it is;
- players can inspect while waiting;
- important teammate danger is visible;
- the UI does not encourage every player to stare only at their own card instead of the shared battlefield.

---

## 8. Phase 7 — Expedition / Boss Interface

Expeditions add longer-session context and more complex objectives.

Add as required:

- expedition encounter/objective state;
- boss phase indicator;
- visible stagger/break/channel state;
- telegraph countdown/state;
- environmental modifier summary;
- extraction/survival objective state;
- reconnect/suspended-expedition context;
- personal loot/reward state **after** combat resolution rather than cluttering active turns.

Boss mechanics should be communicated spatially on the board first, then supplemented by the inspector/top strip.

Do not turn a boss fight into reading a right-side spreadsheet.

---

## 9. Phase 8 — PvP Interface

PvP uses the same cockpit with competitive constraints.

### Required PvP additions

- server-owned decision timer;
- clear warning before timeout;
- disconnect/reconnect/forfeit state;
- opponent inspector restricted to public/known information;
- hidden Reaction/loadout information protected;
- PvP-specific action overrides communicated where material;
- Arena Tempering/normalization state if the rules require visibility;
- rank/queue context outside the tactical board, not as permanent mid-battle promotional chrome;
- equivalent animation timing/readability;
- reduced-opponent-effects option where allowed;
- clear timeout default/forfeit behavior;
- touch/keyboard target selection fast enough for the competitive decision window.

### PV-5 integration

In addition to queue/population metrics, inspect whether battle UI creates competitive friction:

- accidental commits;
- timer lost while navigating command groups;
- hidden-information leaks;
- cosmetics obscuring board state;
- mobile players losing time because inspector/command-sheet interaction is too slow;
- initiative/timeline ambiguity after speed manipulation;
- status/Reaction cues that experienced players interpret differently from what the rules actually do.

Competitive integrity includes interface integrity.

---

## 10. Phase 9 — Full Discipline Roster Expansion

The complete roster should reuse the mature cockpit architecture.

Before adding a new permanent UI primitive for one Discipline, require an explicit answer to:

- can the existing action/status/resource/targeting/inspector systems express it?
- if not, is the new UI primitive reusable by future mechanics?
- does it remain understandable on phone/laptop?
- does it create a hidden-information problem in PvP?
- does it add persistent chrome or only contextual state?

Avoid accumulating dozens of class-specific widgets that make future balancing and responsive design unmanageable.

---

## 11. Phase 10 — Social / Sharing Extensions

Social systems may later add:

- battle-result share cards;
- build/loadout sharing outside active battle;
- spectator invitation surfaces where approved;
- guild/tournament context.

Do not embed social-feed mechanics into the active tactical viewport unless they serve a direct battle need.

---

## 12. Phase 11 — Economy / Combat Item Maturity

When combat items and economy loops mature:

- complete the `Items` command group;
- show quantity/charges clearly;
- show Action Cost Class and target preview;
- prevent unavailable/non-loaded inventory from appearing as usable combat options;
- preserve item authority and idempotent consumption;
- keep bag/inventory management outside active combat;
- prevent the combat item tray from becoming an unrestricted backpack browser.

The command deck reflects the approved combat kit, not the entire account inventory.

---

## 13. Phase 12 — Nation / Large-Context Battles

Nation systems may introduce faction identity, campaign objectives, and team context.

Do not assume this means huge simultaneous tactical battles.

If nation warfare uses the normal combat engine, the same cockpit applies with relevant objective/team presentation.

If a fundamentally different battle scale is ever approved, it requires a separate product/interface design rather than silently stretching the standard cockpit beyond usability.

---

## 14. Phase 13 — Master Panel / Battle Operations

The player cockpit should feed operations through structured battle events and telemetry.

Master Panel additions may include:

- battle replay launch;
- battle snapshot inspection;
- command rejection/error analysis;
- map/targeting heatmaps;
- action usage;
- turn-duration distribution;
- UI friction telemetry where privacy-safe and useful;
- device/performance class summaries;
- content-version inspection;
- selected published battle UI configuration only where genuinely data-driven.

Do not make the Master Panel a CSS editor for arbitrary production battle layouts.

Core cockpit composition remains an engineered product experience, not live content configuration.

---

## 15. Phase 14 — Art & Audio Battle Cockpit Polish

Phase 14 performs the dedicated production pass after the interface has already been useful throughout development.

Polish includes:

- final command-deck frame treatment;
- Current/Legacy/Confluence/Soulmark/Ultimate visual language;
- action/status/terrain/objective icon completeness;
- selected/target/hover/focus/disabled states;
- initiative/timeline visual refinement;
- party/enemy/context inspector presentation;
- forecast typography and hierarchy;
- board overlays;
- telegraphs;
- event ticker/log presentation;
- phone bottom-sheet polish;
- laptop density polish;
- transitions;
- UI SFX;
- turn/timer/objective cues;
- reduced-motion alternatives;
- low-performance VFX mode;
- accessibility contrast/readability pass;
- final world-specific battle scene integration.

Phase 14 must **not** be the first time the command deck becomes usable or the phone battle layout exists.

---

## 16. Phase 15 — Battle Interface Hardening

Hardening should include:

### Responsiveness

- 360–412 px phone widths;
- modern phone portrait;
- landscape/tablet where material;
- 1366×768 laptop;
- 1440×900+ desktop;
- safe areas;
- browser zoom/text scaling;
- no required page-level combat scrolling.

### Interaction

- mouse;
- touch;
- keyboard;
- pan/zoom versus target selection;
- multistage targeting;
- cancel/back;
- confirm;
- no legal target;
- status overflow;
- long names/localization resilience when localization exists.

### Multiplayer

- stale battle version;
- duplicate command submission;
- latency;
- disconnect/reconnect;
- timer expiration;
- teammate control ownership;
- hidden-information enforcement;
- PvP animation/readability parity.

### Performance

- large board within supported scope;
- many units/statuses;
- many initiative entries;
- repeated particle effects;
- long combat event history;
- low-end representative mobile/browser hardware;
- memory growth in long Expedition sessions;
- frame/input responsiveness during overlays and camera movement.

### Accessibility

- keyboard focus/order;
- reduced motion;
- muted audio;
- color-independent cues;
- screen-reader labels/summaries/log;
- no hover-only critical information.

---

## 17. Closed Alpha Battle-Interface Gate

Before the mature Closed Alpha target is considered ready, the battle cockpit must support the released combat content without requiring players to learn different interfaces for different modes.

Required mature state:

- battlefield-first desktop/laptop/phone experience;
- complete released Current/Legacy action grouping;
- Movement Art;
- released Soulmark/Confluence/Ultimate presentation;
- Turn Economy Tracker;
- initiative timeline;
- contextual unit/tile inspector;
- target/path/shape/height/friendly-fire previews for released grammar;
- forecast;
- party rail for co-op;
- boss/Expedition context;
- PvP timer/public-information rules;
- event ticker + full log;
- reconnect/stale-state handling;
- keyboard/touch/accessibility baseline;
- strong audiovisual feedback;
- responsive performance on the project's supported baseline devices.

A player should not need the developer nearby to explain where their abilities, target information, or end-turn control went.

---

## 18. Ticket Requirements for Battle UI Work

Every future battle-interface implementation ticket must state:

- which cockpit region(s) it affects;
- which combat state it renders;
- authoritative data source;
- interaction state machine changes;
- desktop/laptop/phone behavior;
- keyboard/touch behavior;
- accessibility impact;
- loading/pending/error/reconnect behavior;
- automated tests;
- manual tactical verification;
- performance implications;
- media/audio requirements;
- explicitly deferred future interface features.

A ticket implementing `Basic Attack targeting` should not quietly implement the entire final PvP HUD.

---

## 19. Reference-Use Rule

External battle screenshots may be used to identify abstract UX strengths and weaknesses.

They must not be used to copy:

- visual composition pixel-for-pixel;
- colors/themes;
- names/text;
- icon art;
- character/enemy presentation;
- battle assets;
- source code;
- distinctive decorative treatment.

The useful abstract lessons currently incorporated are:

- stable status anchors;
- grouped battle options;
- explicit target/commit flow;
- visible initiative;
- readable combat history;
- separation of decision and consequence.

AUREVANE's solution is its own battlefield-first tactical cockpit.

---

## 20. Roadmap Success Condition

This roadmap integration succeeds when battle-interface work grows in lockstep with actual combat capability:

```text
PHASE 2
small excellent battlefield cockpit
        ↓
PV-1
prove tactical clarity + fun
        ↓
PHASE 3
make Current + Legacy + Confluence visible and usable
        ↓
PV-2
prove AUREVANE build identity
        ↓
PHASE 6–8
extend same cockpit to co-op / Expeditions / PvP
        ↓
PHASE 14–15
polish and harden rather than redesign from scratch
```

The result should feel like one combat product becoming richer over time, not a succession of unrelated battle pages.
