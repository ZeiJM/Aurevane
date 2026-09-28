# Combat v5.1 — Targeting, Summons, Resonance, and Nexus UX Design

**Owner:** Nick  
**Date:** 2026-09-28  
**Working branch:** `agent/combat-v5-1-rebalance-summons-resonance-20260928`  
**Base:** `main` at `69ef19b9385381be1ac4743130e5746736e07123`  
**Status:** approved design direction from owner conversation; implementation must preserve historical pinned content  
**Related workstream:** draft PR #755 remains separate and must not be silently absorbed

## 1. Purpose

Combat v5.1 is a versioned follow-up to the merged Combat v5 release. It has four goals:

1. clean up Nexus / Discipline / Technique presentation and remove avoidable UI lag;
2. rebalance current regular Techniques around role-based AP bands, range, elevation, line-of-sight utility, and positioning difficulty;
3. replace the current passive `Summoned` status behavior for new content with a real temporary allied summon system;
4. broaden Resonance mechanics and improve Resonance presentation/authoring so current Resonances are not mechanically repetitive.

This work creates new current definitions. Existing historical Skill, Essence, Resonance, and battle snapshots remain immutable and continue resolving their pinned versions.

## 2. Release and compatibility boundaries

- Never rewrite Combat v5 historical versions.
- Existing battles retain the exact Skill/Essence/Resonance versions pinned when the battle began.
- New/current character and Nexus views resolve the newest enabled v5.1 definitions.
- Draft PR #755 remains separate. Do not cherry-pick or merge it wholesale.
- Any overlap with #755 must be reconciled deliberately.
- No Production deployment until exact-head verification is complete and the Owner explicitly authorizes release.
- Keep server-authoritative targeting, battle-state validation, combat-content validation, and private-table protections intact.

## 3. Nexus / Discipline Management UX

### 3.1 Discipline selectors

Primary and Secondary Discipline names must be centered both in the closed native select control and, where supported by the browser, in the native option rows.

The selected value remains keyboard and screen-reader accessible. This is presentation only.

### 3.2 Discipline Management lag

The current Discipline Management component runs a one-second state update indefinitely even when both cooldown values are already zero. v5.1 changes this behavior:

- the countdown timer exists only while the dialog is open and at least one remaining cooldown is greater than zero;
- zero-valued countdown state must not be rewritten once per second;
- closing the dialog clears the countdown interval;
- the full-screen modal retains its darkened backdrop but removes the expensive live `backdrop-filter: blur(...)` effect;
- no gameplay behavior or attunement timing changes.

### 3.3 Technique lane alignment in Nexus

When only one Discipline is selected:

- the active Primary Technique lane and the locked Secondary lane use the same header row height;
- the `Locked` heading and live Discipline heading share the same vertical baseline;
- all four locked slots align horizontally with the four live Technique slots;
- internal spacing is proportional to active Technique cards rather than stretched by the extra locked explanatory line.

Responsive behavior remains unchanged in intent.

## 4. Technique Management modal layout

When only one Discipline is selected, the locked Secondary Technique cards must visually align with the active Technique cards:

- same top inset;
- same artwork-box vertical origin;
- same card/grid rhythm;
- locked label sits where the active Skill metadata/name rhythm expects it rather than creating disproportionate whitespace.

The locked row remains clearly disabled and non-interactive.

## 5. Technique Preview presentation

### 5.1 Effect row formatting

Effects in the compact mechanical table are right-aligned like every other value.

Each effect is one visual line and does not wrap. The effect value area must be wide enough at supported desktop widths to keep one effect per line. When a narrow responsive layout cannot preserve this without overflow, the detail rail/layout may stack or widen before allowing effect text to wrap.

No bullet glyphs are shown inside the compact Effects value cell.

### 5.2 Compact magnitude vocabulary

Compact effect summaries show only the mechanic name, concise magnitude, and duration where relevant.

Examples:

- `Dmg [9]`
- `Healing [8] [1 Turn]`
- `MP Restore [5]`
- `Slow [+10 AP] [2 Turns]`
- `Marked [10%] [2 Turns]`
- `Guarded [10%] [2 Turns]`
- `Exposed [12%] [2 Turns]`
- `Hexed [16%] [2 Turns]`

The compact row omits explanatory wording such as `pp Accuracy`, `incoming`, `healing`, and `per tile` when the effect name and the explanatory section below already establish the meaning.

The detailed explanation list below the mechanical table remains authoritative for semantics.

### 5.3 Visual accents

Within compact effect summaries:

- the magnitude/power bracket uses one dedicated accent class;
- the duration bracket uses a different dedicated accent class;
- effect name remains neutral/readable;
- styling is semantic/presentational only and does not modify the stored summary string or combat behavior.

The renderer should emit structured spans rather than attempting to color substrings with fragile string matching in CSS.

## 6. Technique target display

### 6.1 Range

Player-facing Technique Preview displays **maximum range only**.

Examples:

- authored `minimumRange: 1, maximumRange: 3` → `Range: 3`
- authored `minimumRange: 0, maximumRange: 3` → `Range: 3`
- authored `minimumRange: 1, maximumRange: 1` → `Range: 1`
- self target → `Range: N/A`

The engine may still preserve minimum range internally for legality where needed, but the compact Preview intentionally presents reach as the maximum.

### 6.2 Target Method

Target Method describes shape only:

- single → `Single`
- line → `Line`
- circle → `Circle`

Do not append line length or circle radius to Target Method. Reach is communicated by the Range row.

Authored line length and circle radius still remain engine-authoritative geometry fields and remain editable in the Master Panel when applicable.

## 7. Regular Technique v5.1 balance model

### 7.1 AP bands

Current regular Techniques are re-versioned into these role bands:

- Attack: **45–60 AP**
- Utility: **35–50 AP**
- HP-healing Recovery: **45–60 AP**

MP-only recovery/control Skills are treated as utility-equivalent for AP budgeting and generally live in the **35–50 AP** band unless they also provide meaningful HP recovery or major multi-effect recovery.

Mixed Skills use their dominant purpose plus total-value scoring rather than being forced mechanically into the cheapest category.

Essence retains its separate higher/signature cost framework and is re-evaluated against the new targeting budget rather than collapsed into regular Technique bands.

### 7.2 Range distribution

For non-self regular Techniques:

- allowed maximum range: **1–5**;
- range **3** is the normal/median reach;
- range 1–2 is short reach and may receive modestly higher magnitude because positioning is harder;
- range 4–5 consumes more balance budget and reduces available effect magnitude/utility;
- extreme long reach must not also receive top-tier magnitude, broad area, high elevation reach, and LOS bypass without meaningful tradeoffs.

### 7.3 Elevation reach

Elevation reach is deliberately scarce:

- **0** is the default for most Techniques;
- **1** is uncommon and appears only on selected Skills/Disciplines;
- **2** is rare;
- regular current Techniques do not exceed 2 unless a future explicitly versioned rule says otherwise.

Target elevation means the maximum absolute elevation difference between the caster/selection origin and a legal target/affected tile under the existing engine rules.

Elevation is part of the balance budget:

- elevation 0 receives no premium;
- elevation 1 consumes a modest amount of budget;
- elevation 2 consumes a stronger amount of budget;
- a Skill with better elevation access must give up some combination of Power, potency, area, range, cost efficiency, or other utility.

### 7.4 Line of sight

`requiresLineOfSight: false` is a targeting advantage for non-self hostile/support Skills and therefore consumes balance budget.

A no-LOS Skill must be slightly weaker or more expensive than an otherwise equivalent LOS-required Skill.

Self Skills do not receive a no-LOS penalty because LOS is not a meaningful targeting advantage for self-targeting.

### 7.5 Unified targeting score

The v5.1 rebalance utility/magnitude scorer must account for:

- AP cost;
- direct Power/magnitude;
- duration;
- percentage potency;
- number of effects;
- area shape;
- multi-hit;
- maximum range;
- elevation reach;
- LOS bypass;
- displacement/terrain/control;
- Requirements;
- cooldown;
- target-team flexibility;
- Essence/signature weighting where relevant.

Range, elevation, and LOS affect both magnitude allocation and total-value/cooldown scoring so the system cannot compensate in only one place.

### 7.6 Versioning

The rebalance creates new content versions tagged with a new validation marker such as `owner-rebalance-v5-1`.

The prior `owner-rebalance-v5` definitions remain resolvable exactly for historical battle pins.

## 8. Real summon system

### 8.1 New summon mechanic

New v5.1 summoning Skills no longer model a summon as the passive `Summoned` protection status.

They author a dedicated summon effect that spawns a temporary allied combatant.

The legacy `summoned` status remains available only for historical content that already pins it.

### 8.2 Targeting

A summoning Skill targets an **empty ground tile**.

The selected tile must satisfy ordinary authoritative bounds/passability/occupancy/elevation/target-range legality.

If the tile is no longer legal at commit time, the summon does not spawn and the command follows the existing fail-closed action legality model.

### 8.3 Team and ownership

The spawned unit:

- belongs to the summoner's team;
- records the summoner as its owner/source;
- treats the summoner and all allies on that team as friendly;
- treats opposing teams as hostile;
- cannot be controlled manually by a player.

### 8.4 Turn lifecycle

A summon appears immediately on the selected tile but **does not receive a turn in the current round**.

It enters normal deterministic initiative ordering at the next round boundary.

This prevents a free immediate extra action and avoids mutating the current round's frozen initiative semantics.

### 8.5 Lifetime and defeat

A summon has its own HP and can be defeated.

It disappears when either:

1. it is defeated; or
2. it completes its **5th summon turn**.

Expiration is server-authoritative and removes the summon cleanly from placement, active combatant/stat-bridge state, initiative eligibility, temporary effect state, and any summon-owned future schedules.

A summon disappearing must not incorrectly end a battle if its owner/team still has an eligible non-summon combatant.

### 8.6 Summon action kit

A summon has **up to 2 authored abilities total**.

It does not receive a full player action bar and does not automatically inherit Basic Attack / Guard / Recover unless one of those behaviors is explicitly represented by its authored summon abilities in a future version.

On each summon turn:

- it may use **at most 1 authored ability**;
- it may move/reposition and face as ordinary AI logic allows;
- it chooses the most useful legal authored ability based on deterministic AI utility;
- when two choices are effectively tied, the existing seeded deterministic tie-break approach may choose between them;
- if no authored ability is useful/legal, it may move, face, or end turn.

### 8.7 Summon AI

Reuse and adapt the existing build-aware Recruit AI architecture rather than creating an unrelated AI engine.

Summon AI knowledge may inspect authoritative battle state but must not use hidden player-only information beyond what existing server AI is allowed to use.

Summon decision utility must support damage, healing/support, control, resource, positioning, and other authored summon ability effects.

### 8.8 Inspect-only UI

Summons do **not** receive normal player or recruit side panels.

They are visible on the battlefield and selectable through **Inspect**.

Inspect shows summon information needed to understand the unit, including:

- thematic name;
- artwork/portrait;
- owner/summoner;
- remaining summon turns;
- HP/MP and relevant stats;
- tags/statuses;
- authored abilities and concise descriptions;
- relevant movement/initiative information.

### 8.9 Summon authoring contract

Each summoning Skill owns a versioned summon profile containing at minimum:

- stable summon profile ID;
- thematic display name;
- flavor/description;
- portrait/artwork hook;
- tags;
- base HP/MP and stat profile or bounded derivation inputs;
- initiative/movement profile;
- AI profile/behavior hints;
- lifetime (v5.1 current rule = 5 turns);
- 1–2 authored summon abilities;
- ability media/presentation hooks where applicable.

The summon profile is immutable inside each published combat-content version.

### 8.10 Master Panel

Under a Skill containing a summon effect, the Master Panel exposes a dedicated **Summon** authoring section.

Operators can edit the summon profile's approved fields, including:

- name;
- description/flavor;
- artwork;
- tags;
- stats;
- movement/initiative;
- AI hints/profile;
- authored abilities;
- ability effects/targeting/costs within bounded rules.

Validation, semantic diff, deterministic preview, publish history, and rollback must include summon-profile changes.

Browser clients still cannot write private combat-content tables directly.

### 8.11 Summon balance

The parent summoning Skill's total value must account for:

- the summon lasting up to 5 turns;
- summon survivability;
- initiative;
- movement;
- up to two authored abilities;
- expected one-ability-per-turn output;
- targeting flexibility;
- battlefield body/occupancy value;
- support/control value.

A powerful summon must reduce other immediate effects or increase AP/cooldown/Requirement pressure.

## 9. Resonance v5.1 redesign

### 9.1 Goals

Current Resonances must feel materially different from each other rather than being carbon-copy sequence bonuses.

The full current pair catalog should vary across:

- setup tags;
- trigger tags;
- number of required tags;
- setup difficulty;
- whether setup exists at all;
- payoff/result effect family;
- effect magnitude;
- duration;
- recipient;
- control, recovery, resource, damage, cleanse, movement, status, or other bounded mechanics.

### 9.2 Matcher tag count

A setup or trigger matcher may require **1 or 2 canonical tags maximum**.

More restrictive two-tag matchers may justify stronger results.

Validation must reject empty tag lists where the stage exists and reject more than two required tags for current v5.1 definitions.

### 9.3 Optional setup

v5.1 Resonance schema introduces an optional setup stage.

A Resonance may be either:

1. **sequence Resonance** — Setup matcher arms the Resonance; a later Trigger matcher consumes it and produces Result effects; or
2. **immediate Resonance** — no Setup matcher; a matching Trigger Skill immediately produces the Result.

Immediate Resonances are inherently easier to activate and therefore receive a smaller Result budget than comparable sequence Resonances.

Historical v1 schema/content remains valid and resolves with the old sequence behavior.

### 9.4 Terminology

Player-facing Resonance presentation uses:

- **Setup:** the action/tags that arm the sequence, or `None` for an immediate Resonance;
- **Trigger:** the action/tags that cause activation;
- **Result:** the resulting effect(s).

Replace player-facing `Payoff` terminology with `Trigger` for the matcher and `Result` for the actual effect output.

Internal migration may retain compatibility aliases only where needed to deserialize historical content. New schema/API names should prefer `triggerMatcher` / `resultEffects` or equivalently clear typed names.

### 9.5 Result effects

Current v5.1 Resonances allow **1–2 Result effects maximum**.

Result effects can vary across supported bounded effect families. They must not all be damage or resource restore.

The balance model accounts for:

- immediate vs sequence activation;
- one-tag vs two-tag matcher specificity;
- setup/trigger Discipline pairing;
- effect magnitude;
- duration;
- recipient;
- area/control/utility;
- activation difficulty.

### 9.6 Resonance preview layout

The Nexus Resonance hover/focus preview removes unnecessary top whitespace and uses a compact table.

Display:

- `Setup: <discipline · tags>` or `Setup: None`;
- `Trigger: <discipline · tags>`;
- `Result: <compact effect summary>` for each Result effect.

Below the compact table, show the same style of explanatory effect readout used by Technique Preview, one explanation per Result effect.

Magnitude and duration styling should reuse the new structured compact-effect renderer where practical.

### 9.7 Master Panel Resonance authoring

The Resonance editor must support:

- sequence vs immediate mode;
- optional Setup matcher;
- Trigger Discipline;
- Trigger tags (1–2);
- Setup tags when present (1–2);
- 1–2 Result effects;
- flavor line;
- media;
- AI utility values or derived AI utility;
- validation/diff/history/rollback.

The editor label `Payoff` becomes `Trigger`; effect list is labeled `Result`.

## 10. Attunement hover/focus placement

Essence and Resonance detail popups must not be hidden behind the left identity rail or neighboring panels.

Desktop behavior:

- prefer placement to the **right of the artwork/anchor**;
- keep the popup above surrounding content via the existing high z-index;
- clamp/flip only when necessary to stay inside the viewport.

Mobile behavior:

- continue using an above-anchor/stacked fallback appropriate to narrow screens.

Keyboard focus must expose the same content and retain the visible focus ring and `aria-describedby` relationship.

## 11. Master Panel targeting updates

For current v5.1 authoring:

- non-self maximum range input is bounded to 1–5;
- current regular Technique elevation input is bounded to 0–2;
- validation explains that elevation 0 is normal, 1 uncommon, and 2 rare;
- LOS bypass is visibly treated as a balance advantage;
- line/circle geometry remains editable separately from maximum range;
- semantic preview displays the simplified player-facing Target Method and Range rules.

Historical definitions outside v5.1 keep their existing accepted bounds.

## 12. Tests and verification

Implementation must be test-driven and include regressions for at least:

### UI / Nexus
- centered Discipline selection presentation;
- cooldown timer does not rerender at zero / does not run while dialog is closed;
- Nexus active/locked Technique lane header and slot geometry alignment;
- Technique modal active/locked card alignment;
- Essence/Resonance hover placement on desktop and mobile;
- compact effect row right alignment, one line per effect at supported desktop width;
- distinct magnitude and duration spans/classes;
- compact percentage and movement wording;
- simplified Range / Target Method presentation.

### Balance
- every current regular Technique falls in the intended AP band for its dominant role;
- non-self maximum range is 1–5;
- median/current catalog distribution is centered around range 3 rather than long-range saturation;
- most current Techniques use elevation 0;
- elevation 1 is sparse;
- elevation 2 is rarer than elevation 1;
- otherwise-equivalent higher-range Skills receive lower magnitude;
- otherwise-equivalent higher-elevation Skills receive lower magnitude/value allowance;
- otherwise-equivalent LOS-bypass Skills receive lower magnitude/value allowance;
- historical v5 definitions remain resolvable and unchanged.

### Summons
- empty-ground targeting and illegal occupied-tile rejection;
- spawn joins summoner team;
- no same-round summon turn;
- joins initiative next round;
- one authored ability maximum per summon turn;
- at most two authored abilities in profile;
- deterministic utility/tie-break behavior;
- own HP and defeat cleanup;
- five-turn expiration cleanup;
- battle victory does not miscount expired/defeated summons;
- Inspect exposes summon data;
- no normal player/recruit rail is created;
- Master Panel validation/diff/publish/rollback includes summon profile;
- historical `Summoned` status content remains historical.

### Resonance
- schema supports immediate and sequence modes;
- current matchers use max two tags;
- current Results use max two effects;
- immediate mode activates without an armed state and is budgeted weaker;
- sequence mode preserves arm/consume semantics;
- historical Resonance versions keep old schema behavior;
- full current Resonance catalog demonstrates broad semantic variation;
- preview labels Setup / Trigger / Result;
- Result effect explanations render below compact table;
- reduced unused top space.

### Full release gates
- formatting;
- typecheck;
- unit/contract suites;
- Skill Engine;
- representative buildcraft;
- browser smoke;
- responsive Nexus/Technique flows;
- Master Panel authoring E2E;
- battle persistence and historical pinning;
- exact-head full workflow matrix green before merge consideration.

## 13. Implementation order

1. UI/performance cleanup and structured compact effect renderer.
2. Target-display simplification.
3. v5.1 balance scorer and new current Technique versions.
4. Master Panel targeting validation/bounds.
5. summon schema/effect + battle lifecycle + AI + Inspect.
6. summon Master Panel authoring.
7. Resonance schema v2 and runtime compatibility layer.
8. Resonance catalog rebalance + Master Panel + preview.
9. documentation/manual updates.
10. full regression and browser matrix.
11. explicit #755 overlap review before any merge.
