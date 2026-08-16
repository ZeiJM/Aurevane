# AUREVANE — Media Operations & Asset Studio Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` for media storage, generation-provider integration, Asset Studio capability, and owner-controlled replacement/versioning.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/MEDIA_PIPELINE.md` defines the production workflow. `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` define quality. `docs/ASSET_STUDIO_AND_MEDIA_OPERATIONS.md` defines the operating model. This document defines **when** those capabilities enter implementation.

**Direction approved:** 2026-08-16.

The roadmap rule is:

> **Media should become progressively more operational as the game becomes more content-heavy. Do not add expensive generation infrastructure before it is needed, but never let released content become permanently dependent on hard-coded files or an uneditable AI output.**

---

## 1. Cross-Cutting Rule — Stable, Replaceable Media

Starting immediately, player-facing implementation should preserve the ability to migrate important media to stable Asset IDs and Master Panel ownership later.

New systems should avoid architecture that assumes:

- a particular generation vendor will always exist;
- a raw provider URL is permanent content identity;
- every image must live forever inside GitHub `public/`;
- changing art requires editing React/TypeScript;
- changing music requires editing a page component;
- an asset can be deleted safely without checking references;
- generated media may publish without human review;
- owner-uploaded replacements are second-class to generated assets.

This rule does not require building the complete Asset Studio during Phase 1.

---

## 2. Phase 0–1 — Foundation and Request Discipline

Current Phase 1 remains focused on Character Foundation.

Required media posture:

- continue using the existing Art/Audio Request pipeline;
- use stable request/asset identity where current primitives already support it;
- preserve a reusable media registry/component boundary;
- keep generation-provider credentials out of the browser and repository;
- do not add a generation API merely to replace requested-media fallbacks;
- do not turn Supabase Storage into a premature giant CMS before real content volume exists;
- any approved production-quality asset introduced now must have traceable provenance;
- current development-shell images/audio must not become an accidental permanent source-of-truth model.

### Phase 1 gate

Phase 1 does **not** need the full Asset Studio.

It does need an architecture where later replacement of portraits, environment art, music, and other media does not require rewriting the character system.

---

## 3. Phase 2 — Combat Media Proves the Runtime Model

Tactical combat introduces the first media-heavy gameplay canvas.

Phase 2 should prove:

- battle-scene art can be referenced through stable media descriptors;
- combat VFX/SFX requests are traceable;
- approved scene/media assets can have runtime derivatives suitable for desktop/mobile;
- battle presentation does not depend on a provider-specific generated URL;
- a missing optional media asset degrades gracefully without corrupting battle state;
- the Audio Director remains the central playback authority;
- representative image/audio assets can be swapped in development/staging without rewriting combat rules.

Do not build full production generation controls simply because Phase 2 needs a handful of representative assets.

---

## 4. Phase 3–4 — Content Scale Establishes Asset Relationships

As Disciplines, Soulmarks, Confluences, items, battle scenes, enemies, and the first playable roster expand, begin treating media relationships as first-class content data.

Add progressively where justified:

- stable asset IDs for released content categories;
- content-to-asset relationships for icons, portraits, featured art, battle backgrounds, VFX/audio identities, and item thumbnails;
- version/provenance metadata sufficient to distinguish approved runtime media from source requests;
- reusable derivative/crop conventions;
- build-time or authoring validation for missing required media references;
- impact awareness so content growth does not produce anonymous orphan files.

### Phase 4 gate

A representative Discipline and battle-content package should be able to replace its art/audio through stable asset relationships rather than requiring bespoke component edits throughout the UI.

---

## 5. Phase 5 — First Useful Media Operations Slice

Phase 5 is the first major Living World and visual-experience milestone. It introduces enough towns, regions, NPCs, quests, events, weather, story, and ambience that media operations become a real owner need.

The protected Master Panel / story-live-ops shell arriving in Phase 5 should gain a **minimum useful media operations slice** for content that Phase 5 itself needs.

Preferred scope:

- media asset search/read view;
- stable asset record and published-version awareness;
- manual upload/import of approved images/audio for released world/story content;
- preview;
- basic provenance/rights metadata;
- approve/reject state;
- publish/replace current asset version;
- safe rollback to a previous published version;
- content-reference lookup for important world/story assets;
- asset selectors inside the Phase 5 Region/NPC/Quest/Event/Story editors where those editors require media;
- Supabase Storage-backed runtime media where repository-hosted media is no longer the right operational source of truth;
- audit records for privileged publish/replace operations.

### Deliberately not required in the first Phase 5 slice

- full AI image generation integration;
- full music generation integration;
- complex provider switching UI;
- batch generation farms;
- advanced image editing;
- full waveform editor;
- every future item/Discipline/Expedition asset domain;
- complete Phase 13 Asset Studio.

### Phase 5 gate

For a representative released town/region/NPC/story event, the Owner must be able to replace the major image/audio references through safe content/media operations **without editing application source code**.

This is especially important for the Luminous Adventure Shell: world-facing art cannot become operationally frozen once real locations arrive.

---

## 6. Phase 6–8 — Multiplayer, Expeditions, and PvP Media Operations

Extend the existing media operations model only as the underlying systems arrive.

### Phase 6 — Co-op

Add support for released party/social/co-op presentation assets where required.

### Phase 7 — Expeditions

Support:

- environment-kit assets;
- Expedition room/entrance presentation;
- boss portraits/key art;
- boss/Expedition music and ambience;
- event/rotation variants;
- source/reference impact preview for reused modular assets.

### Phase 8 — PvP

Support:

- Arena/season presentation;
- tournament imagery;
- PvP music/ambience contexts;
- rotating competitive presentation assets;
- fair/readable asset version changes that do not alter gameplay rules unexpectedly.

At each phase, content editors should select stable approved assets rather than raw URLs.

---

## 7. Phase 9–12 — Scale the Catalog, Not the Fragility

As the game expands toward the full Discipline roster, social world, economy, and nations, Asset Studio relationships expand with it.

### Phase 9 — Full Discipline Roster

Every new Discipline/Soulmark/Confluence package should have traceable:

- icons;
- featured/character art where required;
- VFX identity;
- SFX identity;
- relevant music/ambience references;
- provenance/version state.

Do not scale to dozens of Disciplines with untracked manually scattered media files.

### Phase 10 — Social World

Add controlled media support for:

- guild presentation;
- social/profile presentation;
- Chronicle commemorative media;
- approved banner/crest assets where game design allows them.

### Phase 11 — Economy

Add Asset Studio relationships to:

- item thumbnails;
- important item key art;
- vendor/store presentation;
- crafting/economy presentation assets.

Item editors should be able to change published media without changing item logic.

### Phase 12 — Nations

Add nation/campaign presentation assets:

- banners/emblems;
- regional/political art;
- campaign event media;
- seasonal presentation.

Nation identity must be editable through content/media data rather than application code.

---

## 8. Phase 13 — Complete Asset Studio + Generation Connectors

Phase 13 completes the owner operating system and is the default home for the **full Asset Studio**.

Required mature capabilities include:

- comprehensive asset search/filter;
- media library by content relationship and category;
- current published version plus complete usable version history;
- source/master upload;
- manual replacement;
- choose/reuse existing approved assets;
- preview in common game contexts;
- image crop/focal-point and derivative controls where supported;
- audio auditioning and loop/stem/gain metadata where supported;
- provenance/licensing/creator/provider fields;
- approval/rejection workflows;
- draft/staging/production publication;
- scheduled publication where useful;
- impact/reference preview;
- retirement safeguards;
- rollback;
- permissions using `media.view`, `media.edit`, `media.approve`, `media.publish` or their final equivalents;
- immutable/auditable privileged history;
- storage-health/invalid-reference diagnostics;
- orphan/unreferenced asset reporting where useful.

### Generation connectors

Phase 13 is the default point for mature provider integration unless an earlier content-production bottleneck proves a narrower connector worthwhile sooner.

The Asset Studio should support server-side provider adapters for approved image/music/audio generation services.

Required rules:

- provider configuration is server-side;
- credentials are secret and environment-scoped;
- generated outputs become candidate versions only;
- human approval is mandatory before production publication;
- manual upload remains permanently available;
- published gameplay does not depend on provider availability;
- provider/model changes do not change stable Asset IDs;
- requests record provenance;
- generation permissions and rate limits exist;
- useful cost/quota visibility is provided where feasible;
- providers have kill switches;
- another provider can replace the current provider without rewriting game content.

### Phase 13 gate

The Owner can administer the media catalog and generation pipeline without routine source-code edits or direct database/storage manipulation.

---

## 9. Phase 14 — Production Media Scale and Quality Pass

Phase 14 remains the dedicated Art & Audio Production Polish phase.

By Phase 14, the Asset Studio should already exist sufficiently that this phase is **production through the pipeline**, not manual file chaos.

Use the established system for:

- large-scale region/character/Discipline/Soulmark/item production;
- music catalog completion;
- ambience/SFX expansion;
- candidate generation where approved providers are useful;
- manual/commissioned imports;
- human review against Art/Audio Bibles;
- master preservation;
- derivative generation;
- mobile/desktop crop and performance review;
- adaptive music/stem relationships;
- VFX/runtime asset registration;
- replacement of lower-quality temporary/development media;
- final provenance cleanup;
- final orphan/missing-reference audit.

### Phase 14 rule

Do not use generation volume as a substitute for art direction.

A small number of excellent, reviewed, coherent assets is better than a huge catalog of inconsistent generated media.

---

## 10. Phase 15 — Media Hardening

Hardening must include the media operations surface.

Validate:

- authorization for every privileged media mutation;
- provider credentials never leak to clients/logs/content metadata;
- upload type/size validation;
- malicious file handling;
- storage path isolation;
- environment separation;
- content reference integrity;
- asset replacement races;
- concurrent publish/rollback behavior;
- cache invalidation/version behavior;
- deleted/retired referenced-asset protection;
- rollback from a bad publication;
- generation provider timeout/rate-limit/error behavior;
- provider outage does not affect existing gameplay;
- cost/quota abuse protections;
- provenance completeness for production assets;
- large-library Asset Studio performance;
- responsive Master Panel media workflows;
- audio/image derivative integrity;
- accessible fallback behavior;
- backup/recovery expectations for irreplaceable approved masters and metadata.

---

## 11. Earlier Integration Exception

A generation-provider integration may move earlier than Phase 13 only if all of the following are true:

1. an active roadmap phase has a real recurring media-production bottleneck;
2. manual generation/import is materially slowing representative-quality testing;
3. the provider integration can be implemented as a narrow reusable server adapter rather than a vendor-specific rewrite;
4. candidate → human review → approval remains mandatory;
5. manual upload/replace remains available;
6. implementation does not pull the complete Asset Studio or unrelated future content forward;
7. the ticket names the provider dependency, security boundary, cost controls, fallback behavior, and future replacement path.

This exception exists to support production pragmatically, not to turn provider experimentation into roadmap churn.

---

## 12. Content Ticket Rule

Once a content domain is operationally mature enough to have Master Panel editing, its tickets must identify media editability where relevant.

A content ticket involving player-facing media should state:

- stable content ID;
- media role(s);
- Asset ID relationship(s);
- whether media is required or optional;
- source/request status;
- fallback behavior;
- who can edit/publish the relationship;
- whether replacement requires no code deployment;
- provenance requirement;
- responsive/performance requirements;
- relevant Asset Studio phase dependency.

The goal is to stop media from becoming an untracked afterthought inside otherwise data-driven content.

---

## 13. Roadmap Success Condition

This roadmap extension succeeds when AUREVANE evolves like this:

```text
TRACEABLE REQUESTS
      ↓
STABLE MEDIA IDENTITIES
      ↓
VERSIONED ASSET RECORDS
      ↓
OWNER MANUAL REPLACEMENT
      ↓
CONTENT EDITOR ASSET SELECTORS
      ↓
FULL ASSET STUDIO
      ↓
OPTIONAL PROVIDER GENERATION ADAPTERS
      ↓
HUMAN REVIEW
      ↓
SAFE PUBLISH / ROLLBACK
```

The end state is not “AI makes all the art.”

The end state is:

> **AUREVANE has a high-quality media production system in which AI, commissions, manual editing, owner uploads, and future providers can all produce candidates, while the Owner retains final control over what the live game actually uses.**
