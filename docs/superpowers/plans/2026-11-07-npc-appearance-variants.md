# NPC appearance variants implementation plan

**Goal:** Let NPC Design staff preview a bounded cohort of related looks and author each selected NPC separately, while reserving exact copies for explicit Game Owner approval.

**Authority:** Unified handover §6.1 / NPC-08 and §14G. The current NPC Design workflow owns drafts, readiness and publication. The existing version 1 appearance catalog owns compatibility and assets.

- [x] Add a staff preview command accepting two to eight looks, a valid base blueprint, and a set of permitted variation fields. Generate compatible unique looks, exclude active NPC matches, and explain when locked features leave too few options. Exact-copy previews require the Game Owner.
- [x] Render a preview roster with portrait and atlas frame. Open one look at a time as a new unsaved NPC, leaving name and intended use to the ordinary editor and retaining the other proposals for review. Preserve unsaved changes and use the existing readiness gates.
- [x] Preserve the current writer contract. Add a service-only, Game Owner checked exact-copy commit with explicit reason and transactional claim checks. Preserve current Arena, Story, World, and fallback art. Keep clone approval details out of player projections.
- [x] Verify preview request authority, bounds, compatibility and exact duplicates in focused Web tests; verify DB permissions, active duplicate rejection and approval lifetime in the existing full-chain database harness. Run relevant adjacent UI/API/rendering tests, formatting, lint and type checks.

The cap is per preview request. Manual generation has no paid provider or background job. The existing version 1 catalog supplies the shared palette and an optional accessory, such as the brooch; authoring a custom insignia depends on the wider art catalog work. The duplicate scope is generated appearances active on published NPCs; player appearance claims have their own authority.

Local verification: preview API/validation, selected-character actor handling, Arena and World readers, the native Staff authority fixture, and the full migration chain against disposable PGlite. Chromium checked desktop and mobile review, independent World draft readiness, explicit Arena admission, and the exact-copy approval flow with fixture authentication. The combined PR still needs configured native browser and CI gates and a concurrent multi-connection PostgreSQL proof. No hosted changes or publication were performed.
