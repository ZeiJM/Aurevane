# AUREVANE — Art Bible

**Status:** Authoritative visual specification

This document governs AUREVANE's visual identity. The Master Game Plan defines what the game is; this Art Bible defines how it should look and how visual assets are produced, reviewed, named, stored, and presented.

## 1. Visual North Star

AUREVANE should feel like a premium tactical fantasy game that happens to run in a browser—not a dashboard wearing fantasy wallpaper.

The visual target is mature, atmospheric, readable, tactile, and original. The world should feel inhabited and storied. Interfaces may borrow the density and clarity of strong persistent browser RPGs, but AUREVANE must have its own fantasy identity, geometry, materials, iconography, composition, and motion language.

`https://www.theninja-rpg.com/` is permitted only as an abstract quality/UX benchmark for a polished browser RPG. Never copy its art, code, text, characters, setting, exact layouts, or proprietary design.

## 2. Core Design Principles

1. **Readability precedes spectacle.** Beauty may enrich information but must never hide it.
2. **Silhouette carries identity.** Characters, creatures, equipment, icons, and effects should remain recognizable before small detail is considered.
3. **Detail follows hierarchy.** Highest detail belongs at the intended focal point.
4. **Materials are believable.** Cloth, leather, metal, stone, wood, glass, bone, skin, and magical substances must feel constructed and weighted.
5. **Supernatural color is purposeful.** Glow and saturation communicate a source, state, interaction, rarity, or exceptional event.
6. **Rarity earns intensity.** Common content is restrained. Legendary gear, Soulmarks, Confluences, bosses, and world events earn stronger presentation.
7. **Shape is as important as hue.** Game-state recognition must not depend on color alone.
8. **Regions vary inside one world.** Climate, culture, ornament, architecture, and palette may change while rendering discipline remains coherent.
9. **Tactical information uses decisive geometry.** Movement, targeting, threat, hazards, elevation, cover, and status states must read instantly.
10. **Reality distortion is exceptional.** Refraction, impossible layered space, spectral glass, and spatial fracture are reserved for powerful supernatural content.
11. **The UI belongs to the world without pretending to be a physical medieval object.** It may echo materials and motifs while remaining modern and usable.
12. **Consistency outranks novelty.** A new asset strengthens the established identity instead of introducing a new aesthetic by accident.

## 3. Character Art Standard

Characters should use believable heroic anatomy rather than exaggerated chibi or hyper-muscular proportions. Faces should be distinctive, human, expressive, and consistent across portraits and full illustrations. Hands, weapons, armor joints, and clothing construction require particular scrutiny because AI-generated defects in these areas quickly lower perceived quality.

Pose should communicate role before effects do. A Bastion should read as stable and protective; a Nightveil should read as precise and elusive; a Stormsinger should feel kinetic; a Chronist should feel controlled and uncanny. Discipline identity should appear through silhouette, equipment, stance, accessories, and controlled supernatural accents—not by covering every character in colored glow.

### Mandatory rejection triggers

Reject or regenerate character art with:

- malformed hands, fingers, limbs, eyes, teeth, or anatomy;
- impossible weapon grips or armor construction;
- duplicated accessories or incoherent costume details;
- unreadable silhouettes;
- inconsistent facial identity between related assets;
- accidental text, watermarks, signatures, logos, or UI fragments;
- excessive bloom that destroys material definition;
- obvious resemblance to copyrighted characters or franchises.

## 4. Character Consistency

Important characters require a reusable identity specification containing at minimum:

- canonical name and role;
- approximate age and presentation;
- face shape and distinguishing features;
- skin, eye, and hair description;
- body type and height impression;
- canonical outfit/equipment;
- signature materials and motifs;
- permitted palette accents;
- forbidden drift;
- reference images when approved.

Portraits, dialogue art, marketing art, and full character illustrations should derive from this identity record.

## 5. Portraits

Portraits are a major identity surface and must remain readable at small sizes.

Recommended production masters should be larger than their runtime use. Runtime variants should be generated deterministically from approved masters.

Portrait framing hierarchy:

- **avatar:** head/shoulders, extremely clear at small size;
- **profile:** head/chest with controlled background;
- **dialogue:** expressive bust or half-body where needed;
- **featured:** higher-detail composition for important NPCs, bosses, rankings, or events.

Never stretch a single low-resolution image across all contexts.

## 6. Discipline Visual Language

Every Discipline requires a visual kit:

- silhouette cues;
- signature equipment or focus;
- shape language;
- material cues;
- restrained accent palette;
- icon family rules;
- VFX principles;
- animation/motion characteristics;
- forbidden visual overlap with nearby Disciplines.

Current Discipline is the primary visual combat identity. Legacy Discipline contributes secondary motifs. A Confluence should visually read as an interaction between the two rather than a third unrelated class skin.

## 7. Confluence Visual Language

Confluences are signature AUREVANE content and should receive special presentation.

A Confluence effect should visually communicate **cause + interaction + result**. For example, a fire/lightning pairing should not merely become a larger generic explosion; visual timing and effect structure should make it clear that one Discipline's state is being transformed or exploited by the other.

Confluence icons should combine established parent motifs without becoming noisy collages.

## 8. Soulmarks

Soulmarks are supernatural identity layers distinct from Disciplines. Their effects may be more uncanny and metaphysical, but still require tactical readability.

Each Soulmark needs:

- a recognizable sigil;
- defined geometry;
- defined motion behavior;
- defined palette family;
- defined material/energy metaphor;
- explicit overlap restrictions with Discipline effects.

## 9. Environment Art

Regions should be identifiable from composition, vegetation, architecture, weather, terrain materials, and lighting—not just color grading.

Environment composition should support gameplay first:

- important paths and entrances remain legible;
- interactable objects stand apart from decoration;
- battle spaces expose elevation, obstacles, and hazards;
- landmarks establish orientation;
- decorative clutter does not obscure tactical information.

Settlements should communicate culture through construction and use, not generic fantasy props. Ruins should imply former purpose. Dungeons should have a readable architectural logic even when layouts are procedurally assembled.

## 10. Creature and Boss Design

Enemies require recognizable combat silhouettes and readable threat language. Different creature families should have shared anatomy/material motifs while preserving individual roles.

Bosses require stronger hierarchy:

- iconic silhouette;
- identifiable weak points or mechanic-relevant features where appropriate;
- clearer phase-change presentation;
- bespoke arena/environmental support;
- higher animation, VFX, SFX, and portrait standards.

## 11. Equipment and Item Art

Equipment should show believable construction. Weapon silhouettes must remain distinguishable in inventory thumbnails. Rare equipment earns ornament, unusual materials, glow, or supernatural deformation gradually rather than making every item visually legendary.

Item thumbnails should remain readable on dark and light-adjacent surfaces and should avoid excessive micro-detail.

## 12. Icon System

Icons must work at small sizes and use consistent stroke, fill, perspective, and detail density.

Categories should be distinguishable by shape language as well as color:

- Arts;
- Traits;
- Reactions;
- Movement Arts;
- Soulmarks;
- Confluences;
- statuses;
- equipment;
- currencies/resources;
- quest/objective markers;
- world/navigation markers.

Icons should not contain text unless explicitly designed as a branded emblem.

## 13. UI Visual Language

AUREVANE UI should combine dense browser-RPG information architecture with modern game-level polish.

Key qualities:

- strong visual hierarchy;
- restrained ornamental framing;
- layered depth rather than flat admin panels;
- deliberate character and location artwork;
- tactile but fast controls;
- clear hover/focus/pressed/disabled/loading states;
- responsive layouts designed intentionally for desktop and mobile;
- consistent panel, card, tooltip, modal, tab, navigation, inventory, stat, combat, and social patterns.

Avoid generic SaaS appearance, default component-library aesthetics, excessive glassmorphism, noisy faux-parchment everywhere, and large empty marketing-style whitespace inside gameplay screens.

## 14. Tactical Readability Priority

When combat information competes for attention, priority is:

1. immediate danger, invalid action, and confirmed target;
2. selected unit and selected ability;
3. valid targets, movement area, path, AoE, and hazards;
4. allies, enemies, objectives, and interactable terrain;
5. elevation, cover, zones, and persistent statuses;
6. environment art and decorative effects.

No VFX may obscure required targeting information for longer than the animation timing necessary to communicate the hit.

## 15. Color and Lighting

Base world rendering should use disciplined naturalistic values. Supernatural colors are accents with meaning.

Semantic UI colors must be centralized as design tokens and pass accessibility checks. Do not encode success, failure, ally, enemy, rarity, or status using hue alone.

Lighting should establish focal hierarchy and atmosphere without crushing shadow detail or blowing out combat effects.

## 16. Motion and VFX

Motion should communicate state and impact.

- UI transitions: fast and restrained.
- Combat anticipation: readable enough to understand intent.
- Hits: clear contact and consequence.
- Powerful abilities: escalation in timing, scale, camera treatment, sound, and particles.
- Idle ambient animation: subtle enough not to compete with decisions.

Respect reduced-motion preferences. Avoid perpetual floating/breathing animation on every panel.

## 17. AI Image Generation Standard

AI may assist asset production, but production code must never depend on a particular generation provider.

Every generated asset requires:

1. an approved request specification;
2. provenance metadata;
3. human review;
4. rejection/regeneration if quality or originality is questionable;
5. conversion from source master into runtime derivatives;
6. repository/storage registration through the media pipeline.

Prompts should describe AUREVANE's own visual rules rather than invoking living artists or requesting imitation of copyrighted franchises.

## 18. Art Request Format

Missing art creates an `ART_REQUEST` in `content/art-requests/`.

Example:

```text
ART-CHR-001
TYPE: Character portrait
SUBJECT: Foundation Bastion mentor
CONTEXT: Early-game tutorial and profile dialogue
MOOD: disciplined, reassuring, battle-worn
COMPOSITION: chest-up, three-quarter view, clear face silhouette
MATERIALS: worn steel, dark leather, muted woven cloth
LIGHTING: soft cool daylight with restrained warm rim
PALETTE: neutral steel/charcoal with low-saturation ochre accent
REQUIRED: readable at 128px, no helmet, identifiable shield motif
AVOID: oversized pauldrons, glowing armor, anime styling, franchise resemblance
OUTPUT MASTER: portrait source, high resolution
STATUS: REQUESTED
```

## 19. Production Asset Workflow

Source art and runtime art are different things.

**Source master** → review → approved master → crop/resize/compress → runtime derivatives → metadata registration → game use.

Do not manually overwrite runtime files without updating their source/provenance record.

## 20. Naming

Use stable, machine-readable lower-case names.

Examples:

```text
chr_bastion_mentor_portrait_v01.webp
disc_bastion_icon_v01.svg
soul_gravity_sigil_v01.svg
env_frostmere_crypt_entrance_v01.webp
item_iron_longsword_thumb_v01.webp
vfx_confluence_arcflash_sheet_v01.webp
```

Names describe identity and role, not prompt text or generation tool.

## 21. Transparency

Usually transparent:

- icons;
- item cutouts;
- isolated characters used as layered UI art;
- decals;
- many VFX sprites.

Usually environmental/full-frame:

- locations;
- battle backgrounds;
- loading art;
- narrative scenes.

Some featured assets require both a transparent master and framed derivative.

## 22. Performance

Visual quality must coexist with browser performance.

- Prefer modern compressed formats where appropriate.
- Generate responsive image sizes.
- Lazy-load noncritical artwork.
- Avoid unbounded full-resolution source downloads.
- Budget particles and post-processing for ordinary consumer hardware and mobile devices.
- Preserve deterministic layout dimensions to reduce visual shifts.

## 23. Review Checklist

Before approval, verify:

- matches AUREVANE visual identity;
- gameplay/readability requirement is satisfied;
- anatomy and construction are believable;
- silhouette works at intended size;
- no unwanted text/watermark/signature;
- no obvious copyrighted-character imitation;
- colors and effects do not conflict with semantic states;
- source/provenance is recorded;
- runtime dimensions and compression are appropriate;
- required transparent/background derivatives exist;
- mobile crop is safe when relevant.

## 24. Prohibited Style Drift

Do not drift into:

- generic mobile gacha gloss;
- chibi proportions as the normal character standard;
- cartoon comedy as the default world tone;
- hyper-saturated neon fantasy everywhere;
- generic AI concept-art haze;
- photorealism inconsistent with established assets;
- faux-parchment overload;
- flat enterprise-dashboard UI;
- direct imitation of another game's signature presentation.

## 25. Final Identity

AUREVANE should be recognizable through disciplined silhouettes, tactile materials, deliberate supernatural accents, strong tactical geometry, atmospheric environments, premium character art, and information-dense but elegant browser-game UI.

The result should communicate: **this is a real fantasy game, with its own world and combat language, delivered through the browser.**
