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

## Delivery sequence

1. Make existing unlabeled charted road sectors visible/selectable from the globe.
2. Add small authored wilderness clusters around major regions.
3. Connect clusters through square-by-square travel without replacing established roads.
4. Add minor locations/settlements/encounter spaces as content warrants.
5. Expand toward near-continuous known-world land coverage while preserving authored quality.
6. Keep the Unwritten Reach/frontier rules separate from ordinary known-world expansion.

## Acceptance

The known world should increasingly feel like a place the player can roam through rather than a collection of eight isolated destination cards. A player looking at an unlabeled land cell should reasonably expect that authored exploration can exist there, while still receiving no spoilers for sectors they have not legitimately charted or discovered.
