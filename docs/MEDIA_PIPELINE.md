# AUREVANE — Visual & Audio Production Pipeline

**Status:** Authoritative production workflow

This document defines how art, music, ambience, SFX, UI media, animation sources, and generated media move from request to approved runtime asset.

## 1. Principles

- Art and audio are product features, not polish deferred until launch.
- Runtime gameplay must never depend on a specific AI-generation vendor.
- Source assets and runtime assets are separate.
- Every production asset requires provenance.
- Missing media creates a structured request instead of an improvised prompt hidden in code.
- Assets are data-driven and referenced by stable IDs where practical.
- Performance budgets are part of approval.
- The Art Bible and Audio Bible override ad-hoc aesthetic decisions.

## 2. Workflow

```text
GAME/FEATURE NEED
  ↓
ART_REQUEST or AUDIO_REQUEST
  ↓
Generate / commission / create source candidates
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
    "method": "generated|commissioned|internal|licensed",
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

The eventual owner Master Panel should support:

- asset search/filter;
- request status;
- preview;
- upload/replace runtime derivatives;
- provenance fields;
- approval state;
- content-to-asset references;
- audio auditioning;
- variant selection;
- rollback/version history.

This is anticipated architecturally but must not be built before its roadmap phase.

## 14. Development Rule

When implementation reaches a feature that requires missing media, create the appropriate request file in `content/art-requests/` or `content/audio-requests/` as part of the ticket. Do not silently use random web images, random generated assets, or temporary untracked audio.
