# PV-1F — Turn Economy & Character Hub Amendment

**Status:** Owner-approved corrective authority for the PV-1 validation slice  
**Date:** 2026-08-18  
**Tracks:** #112, #105  

This document records an explicit owner-approved revision made during failed human product validation. Where this document conflicts with the older validation-slice rules in `docs/COMBAT.md`, **this amendment wins for the systems named here**. Rules not changed here remain governed by the normal canonical combat documents.

The purpose is not to expand into Phase 3. It is to make the existing tactical slice understandable, efficient and testable enough to earn a human PV-1 decision.

## 1. Character and account journey

AUREVANE uses one account with up to **three character slots**.

- Successful account entry lands at **Character Select**.
- Slots are player-facing as Slot 1, Slot 2 and Slot 3.
- An occupied slot shows the character portrait, identity, level and Foundation Discipline.
- An empty slot offers character creation.
- Selecting an occupied character opens that character's **Character Profile** and establishes the selected-character context for character-specific game pages.
- Character Profile is the character hub for Tactical Hall, Controls & Keybinds and Offline Training.
- Account utilities are consolidated under one **Account** menu: Audio Settings, Character Select and Sign Out.
- Character Select intentionally has no game footer. Character-specific game pages use persistent header/footer navigation.

### 1.1 Character deletion

Character deletion is deliberately reversible for 24 hours.

1. The player chooses **Delete Character** from an occupied slot.
2. A dedicated confirmation surface explains the consequence.
3. The player must type exactly `DELETE <CHARACTER NAME>`.
4. The server records `requested_at` and `delete_after = requested_at + 24 hours`.
5. During the grace period the character is not playable and the slot is not reusable.
6. The Character Select card shows a live countdown and **Cancel deletion**.
7. Cancellation is allowed only before the authoritative deadline.
8. Due deletion is finalized transactionally on an authoritative roster/creation boundary; a browser timer is never deletion authority.
9. Associated state follows authoritative FK/cleanup policy and must not leave orphan battle/progression/training state.

## 2. Single active gameplay session

One account may have only **one active gameplay login** at a time.

- The newest authenticated gameplay claim wins.
- A superseded device/window fails closed on its next authoritative game interaction with a clear continued-elsewhere state.
- Session authority is server-side; browser-local flags are not authoritative.
- At most one battle session may be active for an account. Starting/replacing account gameplay safely abandons conflicting active practice battle state.

This rule prevents independent mobile/laptop timelines from creating two simultaneous authoritative fights for the same account.

## 3. Player-facing Offline Training

The Phase 1 system historically called **Wayfarer's Practice** is presented to players as **Offline Training**.

- Time away can produce a bounded Training Report and Rested Momentum according to the established authoritative Phase 1 rules.
- Being online pauses absence accrual; active play never waits for a timer.
- Player-facing time displays are live and server-synchronized rather than frozen timestamps.
- Absence-plan UI explains that the plan describes expected time away; it is not a countdown the player must sit through.
- Reward calculation, caps, provenance and claims remain server-authoritative.

## 4. PV-1F Action Economy

The former validation-slice grammar of a separate Movement Budget plus one normal Action is replaced by one **100-point Action Economy** for ordinary turn spending.

At the start of each active combatant turn:

`Action Economy = 100`

The server stores, resets, validates and spends this value. The browser only displays authoritative state and previews legal intent.

### 4.1 Costs

| Command | Action Economy cost | Notes |
|---|---:|---|
| Inspect | 0 | Utility mode; no authoritative state change |
| Move | 10 per terrain traversal-cost unit | Normal terrain cost 1 = 10; rough cost 2 = 20 |
| Basic Attack | 30 | Can be used more than once if enough economy remains and legality allows |
| Guard | 30 | Applies Guarded; see §6 |
| Recover | 50 | Restores 10% max HP; see §7 |
| Final Facing | 0 | Choosing N/E/S/W commits facing and immediately ends the turn |

There is no hidden browser-side refund or second Action pool. Multiple moves/actions are legal in any sequence while sufficient Action Economy remains and shared combat legality permits them.

Examples:

- Move two normal tiles (20) → Basic Attack (30) → Move one tile (10) → Guard (30) → finish facing: 90 spent.
- Basic Attack (30) → Basic Attack (30) → Basic Attack (30) → finish facing: 90 spent, if every attack is otherwise legal.
- Move through one rough tile (20) → Recover (50) → Move two normal tiles (20) → finish facing: 90 spent.

## 5. Basic Attack v2 starter formula

Basic Attack remains intentionally modest. The validation-slice raw physical attack value is:

```text
rawBasicAttack = 6
               + Level
               + floor(Might × 0.8)
               + floor(Finesse × 0.4)
```

This raw value enters the existing authoritative attack pipeline; it is **not** guaranteed final damage. Accuracy/Evasion, Armor, facing and active mitigation continue to affect the committed outcome.

Facing multipliers remain:

- front: 100%
- side: 110%
- rear: 125%

The formula is versioned starter content. Future weapon/Discipline formulas should replace or extend it through content rules rather than duplicating arithmetic in UI code.

## 6. Guard

**Cost:** 30 Action Economy.

Guard applies the beneficial **Guarded** status:

- incoming damage multiplier: **85%** (15% reduction);
- duration: **2 owner-turn starts**;
- maximum stacks: 1;
- reapplying while the same Guarded status is active is not legal unless later content explicitly changes the stacking rule.

Guard is a real status/effect, not a temporary UI flag.

## 7. Recover

**Cost:** 50 Action Economy.

Recover immediately heals:

```text
healing = round(MaxHP × 0.10)
```

with a minimum of 1 HP for valid positive MaxHP and the normal maximum-HP clamp. Recover is illegal at full HP.

Recover is a modest universal survival action for the validation slice. It does not replace future Discipline healing, consumables or support builds.

## 8. Recruit AI difficulty

Recruit Sparring exposes **Easy / Standard / High**.

Difficulty changes bounded deterministic decision preferences; it must not grant hidden authority or bypass normal legality.

All grades:

- read committed battle state;
- use the same movement/action/facing legality as the player;
- pay the same Action Economy costs;
- cannot read private future intent;
- cannot fabricate movement, damage, healing or statuses.

Easy is more forgiving in prioritization, Standard is the baseline Tactical Hall opponent, and High values efficient damage/positioning more aggressively. Later stronger AI tiers remain later-phase content.

## 9. Battle cockpit information hierarchy

PV-1F uses a compact game cockpit rather than a document-like combat page.

### 9.1 Header

- fixed/sticky battle header;
- objective on the left;
- **only the active player character's Action Economy** is shown as the central player-facing bar;
- one Round control remains; clicking Round opens/closes Combat Log;
- internal Activation/State/version pills are not player-facing controls.

### 9.2 Combatant rails

Player/allies frame the battlefield from the left; opponents frame it from the right when screen width permits.

Persistent compact text stats are limited to:

- Initiative
- Movement
- Jump
- Armor
- Evasion

HP/MP are communicated through portrait/card meters rather than duplicated textual inspector rows.

### 9.3 Buffs and debuffs

Statuses are mini-icons near the combatant card:

- beneficial effects: **green border/treatment**;
- harmful effects: **red border/treatment**.

Clicking a portrait or status icon opens one dismissible contextual bubble showing effect name, polarity, remaining duration and concise mechanical summary. Clicking the facing indicator opens a concise facing explanation.

Only **one contextual popup/bubble** may be open at a time in the battle layer.

### 9.4 Inspect

Inspect is optional/free and is not the default command. Move is the default turn mode.

Inspect:

- visually emphasizes elevated/special terrain;
- puts selected tile/combatant information into the contextual strip above commands;
- does not require a permanent Inspector side panel.

### 9.5 Battlefield

- battlefield uses the available viewport and should not require ordinary internal scrolling to understand the current arena;
- movement previews show reachable/unavailable coloring plus a numbered route trail;
- raised tiles receive a stronger visual elevation treatment;
- battlefield unit tokens show identity/facing without duplicating HP text already represented in side cards.

### 9.6 Commands and footer

Command hierarchy is compact:

- 00 Inspect
- 01 Move
- 02 Basic Attack
- 03 Guard
- 04 Recover
- 05 Finish Turn

The fixed battle footer owns Cancel, Confirm Action and Abort. A collapsible chat surface is reserved on the left. Solo Recruit practice must clearly say chat is unavailable rather than pretending multiplayer messaging already exists.

## 10. Final-facing turn close

Finishing a player turn is intentionally short:

1. choose **Finish Turn**;
2. choose N/E/S/W;
3. that direction is committed authoritatively;
4. the turn immediately ends;
5. opponent resolution begins.

There is no second Confirm after the direction choice.

## 11. Validation rule

Implementing this amendment does **not** pass PV-1. It creates the corrected candidate that humans must test.

PV-1 remains blocked until real testers can:

- enter/select a character without coaching;
- understand the 100-point Action Economy;
- move/attack/guard/recover/final-face without fighting the interface;
- read HP/MP, terrain, elevation, facing, statuses and opponent results;
- recognize meaningful tactical choices;
- show voluntary desire to play another battle at an acceptable rate.

Automation establishes safety and regression coverage only.
