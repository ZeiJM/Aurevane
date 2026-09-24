# Living Atlas — Known-World Expansion Contract

**Status:** Phase 5 implementation direction approved by the Owner on 2026-09-23.

The globe is a world coordinate surface, not an eight-destination menu. The named regional labels identify major regions/civilizations; they do **not** define the only places a player may eventually enter.

## Continuous known-world exploration

The 32 × 16 globe grid is the address space for authored world sectors.

- A charted sector with an authoritative world-sector entry may be selected from the globe whether or not it has a major-region label.
- Unlabeled charted sectors are first-class destinations. Roads are the first proof; wilderness, minor settlements, ruins, caves, coastlines, crossroads and quest locations can use the same contract.
- Hidden/undiscovered sectors remain absent from the player payload. A globe click may report the requested coordinate, but must not reveal a hidden sector name, landmark, route, NPC, objective or terrain payload.
- Sector coordinates must be unique and valid on the 32 × 16 globe grid.
- Major-region labels remain navigation landmarks, not permission boundaries.

## Authored expansion, not filler

World coverage should expand through designed sectors with a clear regional purpose. Do not satisfy coverage targets by creating large numbers of interchangeable empty maps.

A new known-world sector should contribute at least one meaningful distinction such as:

- terrain/path grammar;
- exploration landmark or environmental story;
- encounter/location identity;
- settlement/service/quest function;
- connection between neighboring authored areas.

Reuse of a regional visual language is expected, but local composition and navigable geometry should not collapse into one repeated template.

## Regional settlement identity

The eight initial major-region settlements must be compositionally distinct, not one settlement plan recolored by biome.

Each region should preserve a recognizable archetype in both gameplay geometry and final v02 painting:

- **Aureth Crown:** planned civic/agricultural center with ordered streets and an open civic heart;
- **Verdant Expanse:** dispersed woodland settlement integrated into clearings, forest paths and waterways;
- **Emberreach:** terraced volcanic citadel/industrial stronghold with hardened causeways and hazard-adapted structure;
- **Frostmere:** compact alpine refuge organized around shelter, warmth and mountain constraints;
- **Glasswind Desert:** oasis/caravan settlement with radial water/trade logic and exposed open approaches;
- **Hollow Coast:** harbor/cliff settlement stretched along shoreline, docks, seawalls and tidal terrain;
- **Starfall Highlands:** stepped terrace/observatory settlement with switchbacks and elevated ceremonial space;
- **Umbral March:** fortified frontier outpost with segmented defenses, watch lines and sparse hardened habitation.

Gameplay rows, safe zones, roads, landmarks and painted map composition must agree. Do not merge a geometry redesign against an old painting that visibly communicates a different walkable town.

## Living Atlas presentation requirements

World presentation is part of Phase-5 completion rather than optional polish.

- **Environmental motion:** water/shore flow, wind, regional light, smoke/clouds and motes should move slowly enough for sustained viewing but with enough opacity/travel/contrast to be noticed during ordinary play.
- **Motion accessibility:** the existing environmental-motion toggle and reduced-motion behavior remain required.
- **Globe framing:** zoom magnifies geography within a stable readable globe rather than enlarging the sphere beyond its viewport and clipping the sides.
- **Responsive labels:** region labels, player marker and uncharted annotation stay within safe globe/rim bounds at supported desktop, laptop and mobile sizes.
- **Uncharted territory:** use a deliberate cartographic veil/fog-of-war treatment that communicates unknown world rather than missing artwork or a white placeholder.
- **Sector discoverability:** charted unlabeled sectors receive visible navigation affordances; inaccessible/hidden sectors must not leak names, landmarks, NPCs, objectives or terrain payloads.

## Land and water

Known-world **land** coverage is the initial expansion target. Ocean cells are not automatically walkable destinations. Maritime travel, ports, vessels and sea encounters require their own explicit gameplay contract before ocean traversal is enabled.

## Navigation model

Player-facing navigation should converge on:

```text
Globe grid cell
→ authoritative chart/discovery eligibility
→ WorldSector
→ local 13 × 9 (or future compatible) exploration surface
```

The globe and local Atlas must use the same authoritative sector registry. Do not introduce a second decorative-only list of globe destinations.

Adjacent grid coordinates do **not** automatically create traversal. Cross-sector movement uses explicit authored reciprocal edge gates so water, cliffs, walls and deliberately closed borders remain authoritative.

## Delivery sequence

1. Make existing unlabeled charted road sectors visible/selectable from the globe and expose them through an accessible charted-sector index.
2. Finish the globe/uncharted presentation pass: stable zoom framing, rim-safe labels and deliberate cartographic fog-of-war.
3. Raise environmental-motion visibility while preserving gentle timing, motion-off and reduced-motion behavior.
4. Establish explicit authored adjacent-sector crossing utilities and routefinder contracts.
5. Add small authored wilderness clusters around major regions and connect them through reciprocal edge gates without replacing established roads.
6. Replace the shared initial settlement template with eight distinct regional geometries and matching v02 local-map paintings.
7. Add minor locations/settlements/ruins/caves/coastlines/encounter spaces as content warrants.
8. Expand toward near-continuous known-world land coverage while preserving authored quality.
9. Keep ocean traversal closed until an explicit maritime system exists.
10. Keep the Unwritten Reach/frontier rules separate from ordinary known-world expansion.

## Acceptance

The known world should increasingly feel like a place the player can roam through rather than a collection of eight isolated destination cards. A player looking at an unlabeled land cell should reasonably expect that authored exploration can exist there, while still receiving no spoilers for sectors they have not legitimately charted or discovered.

Phase-5 known-world acceptance additionally requires:

- the initial regional settlements read as eight different places by composition, not merely palette/biome;
- globe zoom no longer creates side-clipped sphere/label presentation at supported sizes;
- uncharted space reads as intentional unknown territory;
- environmental motion is visibly perceptible without becoming distracting;
- charted unlabeled sectors are discoverable and selectable without pixel-perfect clicking;
- new land-sector coverage uses authored traversal/identity rather than bulk filler generation.
