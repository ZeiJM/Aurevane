# Character Creation Foundations

**Audience:** Player  
**Visibility:** Public, spoiler-safe  
**System:** Phase 1 Character Foundation

## Quick answer

Your AUREVANE account and your character are different identities. Your account proves who is signed in; your character name, presentation, pronouns, portrait, starter appearance, attributes, and Foundation Discipline define the permanent adventurer you will play.

Character creation is designed to take only a few minutes and give meaningful direction without creating a permanent first-session build trap.

## Public character name

Your character name is public character identity, not your login email or account identifier.

Names are normalized before they are accepted. The initial rules allow letters with single spaces, apostrophes, or hyphens between name parts. Names are 3–24 characters after normalization. Reserved system/staff names are rejected, and global uniqueness is enforced by the authoritative server when character persistence is introduced.

Formatting tricks do not create a second identity: compatible Unicode forms, capitalization, spaces, apostrophes, and hyphens are normalized into a stable comparison key for uniqueness checks.

## Presentation and pronouns

Presentation and pronouns are identity choices. They do **not** change attributes, combat power, progression speed, loot, or Discipline access.

The initial creation contract supports Masculine, Feminine, and Androgynous presentation references plus He/Him, She/Her, and They/Them pronoun presets. The model is structured so approved options can expand later without rewriting the character system.

## Portrait and starter appearance

Your portrait and starter appearance are cosmetic identity references. They do not encode hidden bonuses or equipment power.

The initial character-creation experience will use official AUREVANE options produced through the approved media pipeline. The game stores stable content references rather than arbitrary image URLs. The broader long-term portrait system described in the Master Plan can expand later without making outside images part of the initial creation contract.

## The four attributes

### Might

Might represents physical strength and force.

### Finesse

Finesse represents precision, critical effectiveness, initiative, and agile combat.

### Intellect

Intellect represents magical potency, healing, and supernatural control.

### Resolve

Resolve represents health, defenses, and status resistance.

Every new character begins from the same baseline in all four attributes. You then assign a small, versioned starting bonus budget. Starting choices can specialize the character, but they cannot reduce any attribute below the shared baseline, and all starting bonus points must be assigned.

Exact starting values are authoritative configuration so balance can be tuned without scattering constants through the interface.

## Foundation Disciplines

Character creation offers exactly six Foundation Disciplines:

- **Vanguard** — balanced armed combat.
- **Farstrider** — ranged combat and battlefield awareness.
- **Shadehand** — mobility, trickery, and opportunism.
- **Ironfist** — unarmed martial combat.
- **Aetherist** — foundation offensive magic.
- **Lifebinder** — foundation healing and support magic.

This first choice establishes a starting combat tradition. Full Mastery, Arts, Traits, Reactions, Movement Arts, Legacy Disciplines, and Confluences belong to later systems and are not secretly granted by the creation contract.

A **Soulmark is not chosen during character creation**. Soulmarks are earned later through progression.

## Initial progression state

A valid new character begins at **Level 1**, with zero earned XP in **progression cycle 1**. Exact long-form XP pacing is controlled by authoritative server configuration and later progression systems rather than client-side assumptions.

## What cannot be decided by the browser

The browser may collect your choices, but it never becomes the authority for character state. The server revalidates creation intent, owns name uniqueness and persistence, reconstructs the valid starting state, and will create the permanent character transactionally when Character Creation + Persistence is implemented.

A browser cannot create a higher starting level, extra XP, extra attribute points, an invented Foundation Discipline, or a mismatched portrait/appearance reference by changing request data.

## Related systems

- Account & Security
- Character Profile & Stats
- Level and XP Progression
- Disciplines and Mastery
