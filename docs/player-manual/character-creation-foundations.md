# Character Creation Foundations

**Audience:** Player  
**Visibility:** Public, spoiler-safe  
**System:** Phase 1 Character Foundation

## Quick answer

Your AUREVANE account and your character are different identities. Your account proves who is signed in; your character name, presentation, pronouns, portrait, starter appearance, attributes, and Foundation Discipline define the permanent adventurer you will play.

Character creation is designed to take only a few minutes and give meaningful direction without creating a permanent first-session build trap.

## Public character name

Your character name is public character identity, not your login email or account identifier.

Names are normalized before they are accepted. The initial rules allow letters with single spaces, apostrophes, or hyphens between name parts. Names are 3–24 characters after normalization. Reserved system/staff names are rejected, and the authoritative server enforces global normalized-name uniqueness when the character is created.

Formatting tricks do not create a second identity: compatible Unicode forms, capitalization, spaces, apostrophes, and hyphens are normalized into a stable comparison key for uniqueness checks.

If another character claims the same normalized name first, creation stays on your account without creating a partial character and asks you to choose another name.

## Presentation and pronouns

Presentation and pronouns are identity choices. They do **not** change attributes, combat power, progression speed, loot, or Discipline access.

The initial creation experience supports Masculine, Feminine, and Androgynous presentation references plus He/Him, She/Her, and They/Them pronoun presets. The model is structured so approved options can expand later without rewriting the character system.

## Portrait and starter appearance

Your portrait and starter appearance are cosmetic identity references. They do not encode hidden bonuses or equipment power.

The initial character-creation experience uses official AUREVANE option references produced through the approved media pipeline. Until requested production artwork is approved, the interface uses traceable AUREVANE fallbacks rather than unrelated web imagery. The game stores stable content references rather than arbitrary image URLs.

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

This first choice establishes a starting combat tradition. Full Mastery, Arts, Traits, Reactions, Movement Arts, Legacy Disciplines, and Confluences belong to later systems and are not secretly granted by character creation.

A **Soulmark is not chosen during character creation**. Soulmarks are earned later through progression.

## Initial progression state

A valid new character begins at **Level 1**, with zero earned XP in **progression cycle 1**. Creation timestamps are supplied by the authoritative server. Exact long-form XP pacing is controlled by later progression systems rather than client-side assumptions.

## Permanent base slot

Phase 1 enables one base character slot per account. The persistence model has a stable slot index so later account-slot systems can extend it without changing the identity of the base character, but extra or premium slots are not part of this feature.

When you confirm creation, the server performs one atomic operation that reserves the normalized name and base slot together. Retries or double taps reuse the same durable creation request rather than making duplicate characters.

After creation succeeds, refreshing the page, reconnecting, signing out, and signing back in all return to the same permanent character.

## What cannot be decided by the browser

The browser collects your choices, but it never becomes the authority for character state. The server revalidates creation intent, verifies that portrait and starter-appearance references are currently offered, reconstructs the valid starting state, owns name uniqueness, and creates the permanent character transactionally.

A browser cannot create a higher starting level, extra XP, extra attribute points, an invented Foundation Discipline, a made-up starter-media reference, another account's character, or a second base-slot character by changing request data.

## If creation is interrupted

If the network drops while creation is being confirmed, do not assume the character was lost or duplicated. Re-enter the authenticated game page. AUREVANE's creation request is retry-safe: if the original transaction completed, the same permanent character is returned; if it did not, no partial character is kept.

If private character persistence is temporarily unavailable, AUREVANE shows a recovery state rather than silently using another environment or fabricating local character data.

## Related systems

- Account & Security
- Character Profile & Stats
- Level and XP Progression
- Disciplines and Mastery
