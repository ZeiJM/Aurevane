# AUREVANE — Asset Studio & Media Operations

**Status:** Authoritative media-operations specification subordinate to `docs/GAME_MASTER_PLAN.md`, `docs/ART_BIBLE.md`, `docs/AUDIO_BIBLE.md`, and `docs/MEDIA_PIPELINE.md`, and complementary to `docs/MASTER_PANEL.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, and `docs/ROADMAP_MEDIA_OPERATIONS.md`.

**Direction approved:** 2026-08-16.

This document makes the owner-control and provider-integration model for AUREVANE media explicit.

The central rule is:

> **Every production image, music track, ambience layer, sound effect, UI asset, animation source, and other player-facing media object must remain replaceable, versioned, attributable, and operable through stable content references rather than being permanently baked into page code or tied to one generation vendor.**

AUREVANE may use AI generation, commissioned work, licensed work, internal production, or owner-uploaded media. The game runtime must not care which method created the current approved asset.

---

## 1. Owner-Control Principle

The Owner must retain final control over all published media.

For any normal player-facing asset, the eventual Master Panel must allow the Owner or appropriately authorized staff to:

- find the asset by stable ID, content reference, category, location, character, Discipline, item, event, or status;
- preview the currently published version;
- inspect prior versions and provenance;
- upload a replacement manually;
- attach or select a different approved existing asset;
- edit safe presentation metadata such as crop/focal point, alt text, loop metadata, gain, tags, and usage notes where applicable;
- generate or import candidate variants when a configured provider is available;
- compare candidates with the current published version;
- approve/reject candidates;
- publish a chosen version;
- schedule publication when supported;
- roll back to a prior valid version;
- retire an asset safely without silently breaking references;
- inspect which game content currently depends on it.

Manual upload/replace is a permanent first-class capability. It must never become unavailable merely because an AI generation provider has been configured.

---

## 2. Stable Asset Identity

Game content should refer to stable media identities rather than arbitrary file paths or vendor response URLs.

Conceptually:

```text
NPC / ITEM / REGION / DISCIPLINE / EVENT
              ↓
        stable asset ID
              ↓
       Media Asset Record
              ↓
     published asset version
              ↓
 runtime derivative(s) in approved storage
```

Example:

```text
NPC: surveyor_elyra
portrait_asset_id: ART-CHR-047

ART-CHR-047
  published_version: 5
  runtime_portrait_128: ...
  runtime_portrait_512: ...
  source_master: controlled location
  status: PUBLISHED
```

Changing the portrait should not require rewriting every quest, profile card, dialogue panel, or page that shows Elyra.

### Hard-coded media rule

Do not make a raw URL or repository filename the enduring semantic identity of important production content.

Temporary local-development assets may use direct paths where appropriate, but production content should converge on stable asset records before the related feature is considered operationally mature.

---

## 3. Asset Record Model

The exact database schema is deferred to implementation, but the model must support concepts equivalent to:

### Media asset

- stable ID;
- kind/category;
- canonical label;
- lifecycle status;
- current published version;
- tags/relationships;
- spoiler/canon sensitivity where relevant;
- required rights/provenance state;
- owner/staff notes;
- created/updated metadata.

### Asset version

- immutable or append-only version identity;
- source method: generated, commissioned, internal, licensed, owner-uploaded, imported;
- source provider when relevant;
- source request/reference;
- source master location;
- runtime derivative records;
- dimensions/duration/format;
- crop/focal/loop/gain metadata where applicable;
- approval state;
- reviewer;
- publication state/time;
- rights/license/provenance metadata;
- checksum or integrity metadata where useful;
- superseded/retired state.

### Content relationship

- content type and content ID;
- asset ID;
- usage role such as portrait, environment hero, icon, battle background, ambience, music context, item thumbnail, quest illustration, VFX sheet;
- optional variant/context metadata.

A version replacement updates the asset's active published version, not every dependent content record individually.

---

## 4. Media Storage Direction

AUREVANE should initially prefer the existing infrastructure rather than adding a new storage vendor without evidence.

### Runtime / operational storage

Supabase Storage is the preferred default for scalable owner-managed runtime media once repository-hosted media is no longer the practical source of truth.

The storage layer must support:

- controlled upload paths;
- environment separation;
- public or signed delivery according to content needs;
- predictable URLs or object keys referenced by version records;
- deletion/retirement safeguards;
- appropriate cache/CDN behavior;
- metadata and database references that remain authoritative even if physical storage layout changes later.

### GitHub

GitHub remains appropriate for:

- request specifications;
- art/audio bibles;
- metadata/configuration where source-controlled;
- small development/runtime assets while scale remains reasonable;
- tooling and code.

Do not bloat the application repository with large production masters merely because Git exists.

### Future storage changes

A future dedicated object/CDN provider may be adopted only if real cost, performance, transformation, delivery, backup, or scale evidence justifies it.

Changing storage providers must not require changing every game content object because stable asset identities remain above the physical storage layer.

---

## 5. Provider-Neutral Generation Architecture

Image/music/audio generation is a **production input**, not a runtime dependency.

The Master Panel may eventually integrate one or more generation providers through server-side adapters.

Conceptually:

```text
ASSET STUDIO
    ↓
Generation Request Service
    ↓
Provider Adapter
  ├─ image provider A
  ├─ image provider B
  ├─ music provider A
  └─ future approved provider
    ↓
Candidate Media
    ↓
Human Review
    ↓
Approved Version
    ↓
Published Runtime Asset
```

### Adapter requirements

Provider integrations must:

- live behind server-only boundaries;
- keep credentials out of browser bundles and content metadata;
- translate provider-specific results into AUREVANE candidate records;
- capture generation provenance and request references;
- expose stable errors rather than leaking raw provider secrets/responses;
- have timeout/retry/rate-limit handling;
- support cost/quota visibility where practical;
- be disableable without breaking already-published game content;
- permit replacement with another provider later.

No gameplay screen should call a generation provider to render ordinary production art or music on demand.

---

## 6. Generation Never Equals Publication

This is non-negotiable.

A generation result enters the system as a **candidate**.

It does not automatically become live content.

Default lifecycle:

```text
REQUESTED
   ↓
GENERATING / IMPORTING
   ↓
CANDIDATE
   ↓
REVIEW
   ↓
APPROVED or REJECTED
   ↓
RUNTIME DERIVATIVES
   ↓
PREVIEW / STAGING
   ↓
PUBLISHED
```

The Owner or authorized reviewer must retain the ability to reject generated media for:

- art-direction mismatch;
- anatomy/construction defects;
- visual inconsistency;
- poor composition;
- bad loops or mix quality;
- recognizable copyrighted resemblance;
- provenance/licensing uncertainty;
- gameplay readability problems;
- performance cost;
- accessibility problems;
- subjective quality concerns.

A provider being able to generate something is not evidence that AUREVANE should publish it.

---

## 7. Manual Replacement Workflow

The Asset Studio must make manual replacement simple.

Example:

```text
ART-CHR-047 — Surveyor Elyra Portrait

LIVE
  v5

[Upload Replacement]
[Choose Existing Asset]
[Generate Candidates]

Upload owner_edit_final.png
   ↓
validate format/dimensions/rights metadata
   ↓
create v6 candidate
   ↓
preview desktop/mobile contexts
   ↓
approve
   ↓
publish v6
```

Existing content continues referencing `ART-CHR-047`; no content-code rewrite is required.

The old v5 remains in history for rollback unless retention policy explicitly permits later archival deletion.

---

## 8. Image Asset Studio Capabilities

As the system matures, image operations should support where relevant:

- source/master upload;
- generated candidate intake;
- image preview at original size and common runtime contexts;
- safe crop/focal point editing;
- responsive derivative generation;
- thumbnail/portrait/card/hero variants;
- transparent-background handling;
- format conversion/compression;
- alt text and accessibility classification;
- artifact/watermark rejection notes;
- character/location identity references;
- compare current versus candidate;
- rights/provenance record;
- staged publication;
- rollback.

The Asset Studio is not required to become a full Photoshop replacement. Complex retouching may happen in an external editor, followed by manual upload of the finished master.

---

## 9. Music / Ambience / SFX Asset Studio Capabilities

Audio operations should support where applicable:

- source/master upload;
- generated or commissioned candidate intake;
- audition in browser;
- waveform/duration metadata where useful;
- loop start/end validation;
- stem relationships;
- loudness/gain metadata;
- music/ambience/SFX/UI classification;
- context tags such as region, battle state, boss phase, story stage, weather, location, menu;
- alternate variants;
- transition compatibility notes;
- reduced/muted-accessibility considerations where relevant;
- runtime encode derivatives;
- compare/review notes;
- staged publication;
- rollback.

The central Audio Director remains responsible for playback behavior. Content editors select stable audio assets/contexts; individual UI pages should not invent independent playback logic.

---

## 10. Content Editors Must Use Asset Selectors

The broader requirement that game content remain owner-editable means content editors should reference media through Asset Studio selectors rather than raw arbitrary URLs wherever practical.

Examples:

- NPC editor → portrait / dialogue art / voice or ambience references;
- Region editor → establishing art / map art / ambience / music;
- Item editor → thumbnail / key art / acquisition presentation;
- Discipline editor → icon / featured art / VFX/audio identities;
- Soulmark editor → sigil / key art / VFX/audio identities;
- Enemy/Boss editor → portrait / battlefield art / combat audio;
- Quest/Story editor → illustration / scene art / music cue references;
- Event editor → banner / environment variant / music / ambience references;
- Expedition editor → environment kit / room art / boss presentation / music;
- Guild/Nation editor → approved banner/crest/background references where allowed.

Editing the content-to-asset relationship should be a validated data operation, not a source-code edit.

---

## 11. Impact Preview and Reference Safety

Before replacing, retiring, or deleting media, the panel should be able to show important current references.

Example:

```text
ART-ENV-018 is used by:
- Frostmere Pass region landing
- Frostmere Pass loading state
- Quest: White Road Survey
- Event: Closed Star Vigil
```

Rules:

- never silently delete an asset that active published content requires;
- prefer retirement/depublication over destructive deletion;
- validate mandatory media dependencies before content publication;
- permit fallback assets only when explicitly approved for that content role;
- support rollback after a bad replacement;
- long-lived cached clients must fail gracefully if an asset version changes.

---

## 12. Rights, Provenance, and Audit

Every production asset requires sufficient provenance for AUREVANE to know why it may be used.

The panel should capture as appropriate:

- source method;
- provider/creator;
- request/commission/license reference;
- creation/import date;
- usage/license notes;
- reviewer/approver;
- publication history;
- replacement/rollback history.

Privileged media mutations are audited.

Generated media with uncertain originality, rights, or provider terms does not pass approval merely because it looks good.

---

## 13. Provider Cost and Quota Safety

Generation can become expensive if exposed carelessly.

The Asset Studio should eventually support safeguards such as:

- permission-gated generation;
- per-request candidate limits;
- provider/model selection restricted to approved configurations;
- approximate/known cost display where the provider exposes useful data;
- monthly/project budget warnings where practical;
- rate limiting;
- cancellation where supported;
- request history;
- no public-player access to unrestricted generation endpoints.

Production asset generation is an owner/staff workflow, not an infinite free toy available to every player unless a future separately designed player feature explicitly warrants it.

---

## 14. Environment and Publication Safety

Media operations respect local/staging/production separation.

Preferred flow:

```text
candidate/master
   ↓
staging preview
   ↓
review in real UI/game context
   ↓
production publish
```

A staging asset should not silently become production because both environments happened to share a filename.

Production publication must reference the intended version explicitly and be auditable.

---

## 15. Runtime Failure Behavior

A generation-provider outage must not affect ordinary gameplay.

Already-published media must continue serving from approved storage independently of generation-provider availability.

If a runtime media object is unavailable:

- use an approved fallback where the content role permits one;
- preserve layout stability;
- log/telemetry the missing asset appropriately;
- never attempt to auto-generate a replacement in the player's request path;
- keep gameplay state authoritative and usable when media degradation is noncritical.

---

## 16. What Remains Code

The Owner-editability goal does not mean arbitrary source code is editable from the Master Panel.

The panel should expose **data-driven content, configuration, relationships, media, and operational state** wherever reasonably safe.

Core engine implementation remains code when changing it would mean changing software behavior itself, such as:

- combat-engine algorithms;
- database security policy;
- authentication internals;
- transaction/idempotency architecture;
- rendering engine internals;
- provider adapter implementations.

The correct pattern is:

> code defines safe capabilities; the Master Panel controls validated content and configuration inside those capabilities.

---

## 17. Definition of Success

The media system is successful when:

- no important production asset is permanently trapped inside a component implementation;
- changing an NPC portrait or region background normally requires no code deployment;
- changing a published music/ambience asset normally requires no code deployment;
- all published media has provenance and version history;
- owner-uploaded media and generated media use the same approval/publication system;
- a generation provider can be disabled or replaced without breaking live gameplay;
- content editors use stable asset relationships;
- the Owner can preview, replace, publish, and roll back media through the Master Panel;
- production media remains high quality because human approval is mandatory;
- the storage and delivery layer can evolve without rewriting game content identities.
