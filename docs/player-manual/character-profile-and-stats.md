# Character Profile & Derived Stats

**Audience:** Player  
**Visibility:** Public, spoiler-safe  
**System:** Phase 1 Character Foundation

## Quick answer

Your character profile is the readable summary of your permanent adventurer. It shows public character identity, Foundation Discipline, Level, the four core attributes, and derived stats calculated from authoritative character state.

The browser can display these values, but it does not own or persist them. Refreshing the profile reconstructs the same read model from server-owned character data.

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

AUREVANE keeps the first-pass derived-stat coefficients in one versioned authoritative configuration rather than duplicating formulas across UI and manual prose.

The profile identifies the active derived-rules version. This Phase 1 configuration is **development balance**, not a guarantee that launch combat will use the exact same coefficients. Balance changes should update the versioned rules and player-facing explanations together rather than letting multiple handwritten formula copies drift apart.

## Calculation provenance

The derived-stat framework records where each current calculation comes from: base rule, Level contribution, and attribute contributions. Later systems can add typed modifier sources without creating a second calculator.

This provenance is primarily an engineering and support integrity feature. The normal profile emphasizes understandable results instead of exposing internal arithmetic as a wall of numbers.

## What the profile does not do yet

The Phase 1 profile does not implement:

- XP awards or level-up mutation;
- equipment bonuses;
- Discipline Mastery bonuses;
- Arts, Traits, Reactions, or Movement Arts;
- Legacy Discipline or Confluence modifiers;
- Soulmark modifiers;
- battle terrain, facing, target, or status calculations;
- inventory or loadout bonuses;
- premium character slots;
- Master Panel balance editing.

Those systems can later contribute to the same authoritative stat framework when their roadmap phases are implemented.

## Security and ownership

Your profile route loads the authenticated account's character through the same owner-isolated character persistence boundary used by game entry.

The public profile read model deliberately excludes private account linkage and the internal normalized name key. Editing HTML, JavaScript state, or displayed numbers in a browser cannot change the authoritative character or its derived stats.

## Related systems

- Character Creation Foundations
- Account & Security
- Level and XP Progression
- Disciplines and Mastery
- Tactical Combat
