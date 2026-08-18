# Character Creation

**Audience:** Player  
**Visibility:** Public, spoiler-safe  
**System:** Character creation

## Quick answer

Your AUREVANE account and your characters are different identities. Your account proves who is signed in; each character has their own public name, presentation, pronouns, portrait, starter appearance, attributes, Discipline, and progression.

Character creation is designed to take only a few minutes and give meaningful direction without creating a permanent first-session build trap.

## Public character name

Your character name is public character identity, not your login email or account identifier.

Names are normalized before they are accepted. The initial rules allow letters with single spaces, apostrophes, or hyphens between name parts. Names are 3–24 characters after normalization. Reserved system/staff names are rejected, and the authoritative server enforces global normalized-name uniqueness when the character is created.

Formatting tricks do not create a second identity: compatible Unicode forms, capitalization, spaces, apostrophes, and hyphens are normalized into a stable comparison key for uniqueness checks.

If another character claims the same normalized name first, creation remains on your account without creating a partial character and asks you to choose another name.

## Presentation and pronouns

Presentation and pronouns are identity choices. They do **not** change attributes, combat power, progression speed, loot, or Discipline access.

The initial creation experience supports Masculine, Feminine, and Androgynous presentation references plus He/Him, She/Her, and They/Them pronoun presets. Approved options can expand later without rewriting the character system.

## Portrait and starter appearance

Your portrait and starter appearance are cosmetic identity references. They do not encode hidden bonuses or equipment power.

The game stores stable approved content references rather than arbitrary image URLs. Character imagery may later include approved animated assets where the interface supports them.

## The six attributes

Every character is built from six core attributes. Each begins from the same baseline; creation gives you a small bonus budget to shape strengths without lowering any attribute below that baseline.

### Might

Physical force. Might contributes to physical power, armor, and jumping force.

### Finesse

Precision and technique. Finesse contributes to physical power, accuracy, and critical chance.

### Vitality

Endurance and bodily toughness. Vitality is the main attribute behind maximum HP and contributes strongly to armor.

### Agility

Mobility and reflex. Agility is the main attribute behind movement and evasion and also contributes to initiative and jumping.

### Intellect

Mystic understanding. Intellect contributes to magical power, maximum MP, warding, and magical precision support.

### Resolve

Willpower and supernatural steadiness. Resolve contributes to MP, ward, initiative, evasion support, and status resistance.

New characters begin at **5 in every attribute** and assign exactly **6 bonus points**. No single attribute may receive more than 4 of those starting bonus points. Derived combat and adventure stats are calculated by the authoritative ruleset from these attributes and other legitimate progression sources.

The six-attribute model deliberately separates endurance from Resolve and mobility/reflex from Finesse so one attribute does not have to carry too many unrelated jobs.

## Disciplines

A **Discipline** is a learnable combat tradition. It shapes your starting tactical direction and the kinds of tools your character first studies, but it is **not a permanent class lock**. AUREVANE progression is intended to let characters broaden, deepen, and eventually combine what they know through later mastery systems.

Character creation initially offers six Disciplines:

- **Vanguard** — balanced armed combat.
- **Farstrider** — ranged combat and battlefield awareness.
- **Shadehand** — mobility, trickery, and opportunism.
- **Ironfist** — unarmed martial combat.
- **Aetherist** — offensive magic.
- **Lifebinder** — healing and support magic.

This first choice establishes a starting combat tradition. Full Mastery, Arts, Traits, Reactions, Movement Arts, Legacy Disciplines, and Confluences belong to later progression systems and are not secretly granted by character creation.

A **Soulmark is not chosen during character creation**. Soulmarks are earned later through progression.

## Initial progression state

A valid new character begins at **Level 1**, with zero earned XP in **progression cycle 1**. Creation timestamps and permanent state are supplied by the authoritative server.

## Character slots and entering the game

The account roster supports **three character slots**. Creating a character occupies the chosen slot and does not overwrite another character.

When you confirm creation, the server performs one atomic operation that reserves the normalized name and slot together. Retries or double taps reuse the same durable creation request rather than making duplicate characters.

After creation succeeds, that character immediately becomes your active character and AUREVANE takes you into the game instead of returning you to Character Select.

Character Select is primarily shown when entering an authenticated session or when you deliberately choose **Account → Switch Character**. If you swap away from a character, that swapped-away character has a **one-hour return cooldown** before it can be selected again. The cooldown is enforced by the server and is shown on the roster.

## What cannot be decided by the browser

The browser collects your choices, but it never becomes the authority for character state. The server revalidates creation intent, verifies stable content references, reconstructs the valid starting state, owns name uniqueness, and creates the character transactionally.

A browser cannot create a higher starting level, extra XP, extra attribute points, an invented Discipline, a made-up starter-media reference, another account's character, or bypass a character return cooldown by changing request data.

## If creation is interrupted

If the network drops while creation is being confirmed, do not assume the character was lost or duplicated. Re-enter the authenticated game page. AUREVANE's creation request is retry-safe: if the original transaction completed, the same permanent character is returned; if it did not, no partial character is kept.

If private character persistence is temporarily unavailable, AUREVANE shows a recovery state rather than fabricating local character data.

## Related systems

- Account & Security
- Character Profile & Stats
- Level and XP Progression
- Disciplines and Mastery
