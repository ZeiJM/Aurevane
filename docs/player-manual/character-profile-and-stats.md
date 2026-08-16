# Character Profile, Level & Derived Stats

**Audience:** Player  
**Visibility:** Public, spoiler-safe  
**System:** Phase 1 Character Foundation

## Quick answer

Your character profile is the readable summary of your permanent adventurer. It shows public character identity, Foundation Discipline, Level and Character XP progress, the four core attributes, and derived stats calculated from authoritative character state.

The browser can display these values, but it does not own or persist them. Refreshing the profile reconstructs the same read model from server-owned character data and the active versioned progression/stat rules.

## Level and Character XP

**Level** is the broad Character progression track. AUREVANE's character-level foundation supports Levels 1 through 100, while other progression systems such as Discipline Mastery remain separate systems rather than being folded into the Level number.

**Character XP** advances the Level track. Your profile shows:

- current Level;
- cumulative Character XP;
- the cumulative XP threshold for the next Level;
- progress earned inside the current Level;
- the active XP-curve version;
- an explicit maximum-Level state when the configured cap is reached.

XP thresholds come from one versioned server configuration. The current Phase 1 curve is **development balance**, not a promise that launch reward pacing will use identical numbers. Profile presentation reads the active configuration instead of maintaining a second handwritten copy of the curve.

Character XP is server-authoritative. Authorized game services can grant XP with a recorded source and reason; the grant is atomic, retry-safe, and can cross multiple Levels in one award. Editing HTML, JavaScript state, request payloads, or the displayed progress bar cannot award XP or select a Level.

The Level resolver does **not** contain calendar gates, daily timers, or a hidden "wait until Day X" rule. Long-form AUREVANE pacing is produced by meaningful content, reward rates, mastery/build/world progression, and later systems working together. Level alone is not the whole six-month first-character journey.

Wayfarer's Practice is a separate later Phase 1 return/catch-up system. When implemented, it may become one bounded authoritative XP source, but it does not change the rule that the browser never determines elapsed time or reward values.

## Core attributes

AUREVANE uses four permanent character attributes.

### Might

Might represents physical strength and force. It contributes to physical effectiveness, durability, armor, and jump capability in the current Phase 1 derived-stat rules.

### Finesse

Finesse represents precision and agile combat. It contributes to physical effectiveness, accuracy, evasion, critical chance, initiative, movement, and jump capability.

### Intellect

Intellect represents magical potency, healing, and supernatural control. It contributes to MP, mystic power, ward, and part of accuracy.

### Resolve

Resolve represents health, defenses, stability, and status resistance. It contributes to HP, MP, defensive ratings, initiative, evasion, and status resistance.

These relationships describe the current versioned Phase 1 rules. Later equipment, Discipline, Soulmark, Confluence, status, terrain, and battle systems may contribute additional modifiers through the same authoritative calculation boundary.

## Derived stats

Derived stats summarize what your current attributes and Level mean for gameplay-facing values.

### Maximum HP

Your normal maximum health before temporary battle effects.

### Maximum MP

Your normal maximum MP before temporary battle effects. MP is used by authored Arts and other systems that explicitly spend it.

### Physical Power

Baseline rating for physical effectiveness before equipment, Discipline, Art, status, and battle-specific modifiers.

### Mystic Power

Baseline rating for magical and supernatural effectiveness before later build and battle modifiers.

### Armor

Baseline physical defense rating.

### Ward

Baseline mystic defense rating.

### Accuracy

Baseline hit reliability before target, terrain, facing, Art, status, and other combat-specific modifiers. The profile displays this as a percentage for readability.

### Evasion

Baseline ability to avoid eligible attacks before battle-specific modifiers. The profile displays this as a percentage.

### Critical Chance

Baseline critical chance before equipment, Arts, statuses, and other authored modifiers. The profile displays this as a percentage.

### Initiative

Baseline influence on turn ordering before combat-specific timing effects.

### Movement

Your baseline Movement stat. In tactical combat, a normal turn receives a **Movement Budget** derived from this stat and temporary modifiers. Terrain and movement-profile rules determine what that budget can actually reach; the profile does not attempt to calculate a battle path.

### Jump

Baseline vertical movement capability before movement-profile, terrain, status, and temporary modifiers.

### Status Resistance

Baseline resistance to hostile status effects before the specific status rule and battle modifiers are applied. The profile displays this as a percentage.

## Why exact coefficients are not copied into this article

AUREVANE keeps first-pass derived-stat coefficients and XP thresholds in versioned authoritative configuration rather than duplicating formulas/curves across UI and manual prose.

The profile identifies the active derived-rules and XP-curve versions. These Phase 1 configurations are **development balance**, not a guarantee that launch combat or progression will use the exact same tuning. Balance changes should update versioned rules and player-facing explanations together rather than letting multiple handwritten copies drift apart.

## Calculation provenance

The derived-stat framework records where each current calculation comes from: base rule, Level contribution, and attribute contributions. Later systems can add typed modifier sources without creating a second calculator.

XP grants likewise record provenance: authoritative source category, source identifier, reason, requested/applied XP, before/after XP and Level, curve version, and milestone timing. This telemetry is used to understand real progression speed without making the player's browser authoritative.

This provenance is primarily an engineering, balance, and support integrity feature. The normal profile emphasizes understandable results instead of exposing internal transaction records as a wall of numbers.

## What the profile does not do yet

The current Phase 1 profile/progression foundation does not implement:

- combat, quest, world, or event XP reward emitters;
- Wayfarer's Practice claims or offline XP calculation;
- equipment bonuses;
- Discipline Mastery bonuses or Mastery XP;
- Arts, Traits, Reactions, or Movement Arts;
- Legacy Discipline or Confluence modifiers;
- Soulmark modifiers;
- battle terrain, facing, target, or status calculations;
- inventory or loadout bonuses;
- Horizon eligibility or calendar-gated endgame progression;
- Rekindling or Veteran Edge;
- premium character slots;
- Master Panel progression editing or pacing simulation.

Those systems can later call or contribute to the same authoritative progression/stat boundaries when their roadmap phases are implemented.

## Security and ownership

Your profile route loads the authenticated account's character through the same owner-isolated character persistence boundary used by game entry.

The public profile read model deliberately excludes private account linkage and the internal normalized name key. Browser roles have no direct permission to mutate Character Level/XP, execute the privileged XP-grant transaction, or read the private grant ledger/curve tables.

Editing HTML, JavaScript state, request payloads, or displayed numbers in a browser cannot change the authoritative character, Level, XP, or derived stats.

## Related systems

- Character Creation Foundations
- Account & Security
- Disciplines and Mastery
- Wayfarer's Practice
- Natural Long-Form Pacing
- Tactical Combat
