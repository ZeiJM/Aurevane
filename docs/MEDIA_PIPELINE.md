# AUREVANE — Visual & Audio Production Pipeline

**Status:** Authoritative production workflow

This document defines how art, music, ambience, SFX, UI media, animation sources, and generated media move from request to approved runtime asset.

For the detailed owner-control, stable asset identity, manual replacement, storage, generation-provider, publication, and rollback model, see `docs/ASSET_STUDIO_AND_MEDIA_OPERATIONS.md`. For implementation timing, see the binding roadmap extension `docs/ROADMAP_MEDIA_OPERATIONS.md`.

## 1. Principles

- Art and audio are product features, not polish deferred until launch.
- Runtime gameplay must never depend on a specific AI-generation vendor.
- Source assets and runtime assets are separate.
- Every production asset requires provenance.
- Missing media creates a structured request instead of an improvised prompt hidden in code.
- Assets are data-driven and referenced by stable IDs where practical.
- Performance budgets are part of approval.
- The Art Bible and Audio Bible override ad-hoc aesthetic decisions.
- Owner-uploaded/manual media is a permanent first-class path alongside generated, commissioned, internal, and licensed media.
- Generation output is always a candidate until explicitly reviewed and approved; generation never equals publication.
- Important production media must remain replaceable and versioned without requiring routine source-code edits once its content domain is operationally mature.

## 2. Workflow

```text
GAME/FEATURE NEED
  ↓
ART_REQUEST or AUDIO_REQUEST
  ↓
Generate / commission / create / owner-upload source candidates
  ↓
Human review against Bible + gameplay need
  ↓
Approved source master
  ↓
Edit / clean / crop / mix / master
  ↓
Generate runtime derivatives
  ↓
Record metadata + provenance
  ↓
Register stable asset ID
  ↓
Integrate in staging/game
  ↓
Performance + accessibility + gameplay review
  ↓
APPROVED FOR PRODUCTION
```

## 3. Repository Structure

```text
content/
  art-requests/
  audio-requests/
  seed/
  balance/

public/
  media/
    art/
      characters/
      disciplines/
      soulmarks/
      environments/
      creatures/
      items/
      ui/
      vfx/
    audio/
      music/
      ambience/
      sfx/
      ui/
```

Large production masters should eventually live in controlled object storage or an appropriate asset store rather than bloating the application repository. Runtime assets may live under `public/media` while their scale remains practical.

Supabase Storage is the preferred initial operational object-storage direction once repository-hosted runtime media is no longer sufficient, subject to later evidence-based change. Stable Asset IDs and database/content metadata must sit above the physical storage path so future storage migration does not require rewriting game content.

## 4. Request IDs

Art:

```text
ART-CHR-001
ART-ENV-001
ART-DISC-001
ART-SOUL-001
ART-ITEM-001
ART-UI-001
ART-VFX-001
```

Audio:

```text
AUDIO-MUS-001
AUDIO-AMB-001
AUDIO-SFX-001
AUDIO-UI-001
AUDIO-BOSS-001
AUDIO-EXP-001
```

IDs are stable and should remain referenced in commit history even if the production filename changes.

## 5. Asset Metadata

Each approved asset should eventually have metadata equivalent to:

```json
{
  "id": "ART-CHR-001",
  "kind": "character-portrait",
  "status": "approved",
  "source": {
    "method": "generated|commissioned|internal|licensed|owner-uploaded",
    "provider": "optional",
    "createdAt": "ISO-8601",
    "license": "terms/reference",
    "promptSpec": "optional request reference"
  },
  "master": "controlled-source-location",
  "runtime": [
    {"path": "/media/art/characters/example.webp", "width": 512, "height": 512}
  ],
  "approvedBy": "owner/reviewer",
  "notes": ""
}
```

Never commit secrets or private vendor credentials into metadata.

## 6. Image Production

For images:

1. Write/approve an Art Request.
2. Produce multiple source candidates when appropriate.
3. Reject anatomy, construction, composition, consistency, copyright, or watermark problems.
4. Retouch approved source when needed.
5. Preserve a high-resolution master.
6. Produce deterministic runtime crops/sizes.
7. Encode appropriate runtime formats.
8. Verify desktop and mobile crops.
9. Register metadata.
10. Integrate using a reusable media component rather than arbitrary `<img>` usage everywhere.

## 7. Audio Production

For audio:

1. Write/approve an Audio Request.
2. Produce or acquire source candidates.
3. Reject recognizable copyrighted melodies/samples, artifacts, clipping, poor loops, or unsuitable mix density.
4. Edit and master the approved source.
5. Produce runtime encodes and stems where required.
6. Verify loop boundaries.
7. Register metadata.
8. Integrate through the central audio runtime.
9. Test at representative volume settings and with music/SFX/ambience combinations.

## 8. Adaptive Music

Tracks intended for adaptive use should share compatible timing and loop structures where possible. Metadata should describe context and optional stems such as:

```text
ambient
rhythm
melody
tension
climax
```

The game state chooses music context; UI components do not manually start arbitrary tracks.

## 9. Runtime Media Architecture

Application code should consume stable descriptors rather than provider-specific generation outputs.

Example conceptual shape:

```ts
interface MediaAsset {
  id: string;
  kind: string;
  src: string;
  width?: number;
  height?: number;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
}
```

Later this may be backed by database/content records managed from the Master Panel.

Important production content should converge on stable Asset IDs so replacing a portrait, region image, track, ambience layer, or other media object does not require editing every consumer of that asset.

## 10. Performance

Before production approval:

- images use appropriate dimensions and compression;
- responsive images do not download desktop masters on mobile unnecessarily;
- noncritical media lazy-loads;
- audio is streamed/preloaded according to context;
- simultaneous SFX are concurrency-limited;
- large music files do not block initial page interaction;
- loading states exist for important art that is not yet available;
- animations and particles are budgeted for ordinary consumer hardware.

## 11. Accessibility

- Provide alt text when imagery carries information.
- Decorative images should not create screen-reader noise.
- Combat state cannot depend on color or sound alone.
- Respect reduced motion.
- Provide separate audio volume categories and mute controls.
- Avoid uncontrolled flashing or painful audio peaks.

## 12. Legal and Provenance

Do not ship assets with uncertain rights.

Never:

- scrape copyrighted game assets;
- hotlink third-party art as a permanent production strategy;
- imitate a copyrighted character or logo;
- ask generation systems to copy a living artist's exact style;
- use music resembling a recognizable copyrighted theme;
- lose the origin/license record for an approved asset.

## 13. Master Panel Future Requirement

The owner Master Panel evolves toward the Asset Studio defined in `docs/ASSET_STUDIO_AND_MEDIA_OPERATIONS.md`.

It should ultimately support:

- asset search/filter;
- request status;
- current published version and version history;
- preview in representative game contexts;
- manual source/master upload and replacement;
- choose/reuse an existing approved asset;
- provider-generated candidate intake where configured;
- provenance/licensing fields;
- approval/rejection state;
- content-to-asset references and impact lookup;
- image crop/focal/derivative controls where supported;
- audio auditioning and loop/stem/gain metadata where supported;
- variant selection;
- staged publication;
- safe retirement;
- rollback/version history;
- audited privileged operations.

Manual upload/replace must remain available even when generation providers are configured.

Generated candidates must not publish automatically.

The complete Asset Studio is a later roadmap capability, but a minimum useful media-operations slice arrives alongside the Living World/Story Master Panel work when content volume makes owner replacement a real operational need. The exact sequence is binding in `docs/ROADMAP_MEDIA_OPERATIONS.md`.

## 14. Development Rule

When implementation reaches a feature that requires missing media, create the appropriate request file in `content/art-requests/` or `content/audio-requests/` as part of the ticket. Do not silently use random web images, random generated assets, or temporary untracked audio.

When a content domain becomes Master Panel-editable, its player-facing media relationships should also become editable through stable Asset IDs/selectors wherever reasonably practical. Do not build a data-driven NPC, region, item, Discipline, event, quest, or other content editor whose important media remains permanently hard-coded in application source.

## 15. Generation Provider Rule

Generation-provider integration is optional production infrastructure, not a prerequisite for ordinary gameplay.

If/when a provider is connected:

- calls occur through server-only provider adapters;
- credentials remain secret and environment-scoped;
- generated output enters the Asset Studio as candidates;
- request/provider provenance is retained;
- human approval remains mandatory;
- rate limits/cost controls exist;
- provider failure does not affect already-published runtime media;
- the provider can be disabled or replaced without changing stable Asset IDs or game content relationships.

A provider may be integrated earlier than the complete Asset Studio only when an active roadmap phase has a demonstrated recurring production bottleneck and the ticket preserves these boundaries.
