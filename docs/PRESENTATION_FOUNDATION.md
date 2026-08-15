# AUREVANE — Phase 0 Presentation Foundation

**Implementation status:** F0.4 foundation document. The Art Bible, Audio Bible, Media Pipeline, Game Master Plan, and Technical Architecture remain authoritative.

## Design system

`packages/ui` owns the small shared presentation vocabulary established in Phase 0:

- semantic color, typography, spacing, radius, timing, focus, and surface tokens;
- restrained game-surface framing;
- reusable button, kicker, status-mark, and surface primitives;
- reduced-motion treatment for shared transitions.

The system intentionally uses platform CSS rather than importing a general-purpose component framework. Player-facing feature tickets should extend these primitives only when a genuinely reusable pattern appears.

## Responsive shell

The Phase 0 web shell is desktop-first for information density but must remain intentionally usable at mobile widths. Navigation, shell framing, settings controls, typography, hit targets, and overflow are verified at representative desktop and mobile viewport sizes.

The shell is presentation only. Disabled/preview navigation labels do not imply that gameplay systems already exist.

## Image/media registry

Web presentation consumes artwork through stable media descriptors rather than arbitrary image paths. Requested assets include their Media Pipeline request ID. Approved image records must provide runtime source, dimensions, and accessibility metadata before the reusable image component will render them as production media.

Missing/requested media renders a deliberate in-world-safe fallback instead of a broken image or random placeholder.

Initial request: `ART-UI-001`.

## Audio runtime

`packages/audio` owns:

- versioned audio settings state;
- Master, Music, SFX, Ambience, and UI channels;
- mute without destroying saved channel levels;
- the stable audio-asset registry;
- the central `AudioDirector` Web Audio graph;
- browser-gesture unlock;
- routed approved-asset playback;
- a short synthesized calibration tone used only to verify settings before production UI SFX exists.

The constructor does not create an `AudioContext`. The web client calls `unlock()` only from an explicit player interaction, so the runtime does not attempt autoplay.

Pre-login settings persist in local storage under a versioned AUREVANE key. Account-level settings synchronization can be added when account/profile settings are implemented; local storage is never authoritative game state.

Initial requests: `AUDIO-MUS-001`, `AUDIO-AMB-001`, and `AUDIO-UI-001`.

## Accessibility baseline

- semantic landmarks and headings;
- visible keyboard focus;
- controls use native buttons/inputs/details where practical;
- no shell status depends on hue alone;
- meaningful media requires alt text when approved;
- decorative media stays out of the accessibility tree;
- reduced-motion preference disables nonessential transitions;
- audio is optional and independently adjustable by channel.

## Documentation impact

- **Manual article:** future Settings & Accessibility article must document Master/Music/SFX/Ambience/UI controls, mute behavior, and browser audio unlock.
- **Contextual help:** F0.4 provides concise labels/status copy in the settings surface; full manual deep links arrive with the manual UI.
- **Glossary:** no new gameplay terminology.
- **Screenshots/diagrams:** production screenshots wait until approved media and the player manual surface exist.
- **Spoilers:** the Phase 0 shell contains no unreleased lore, hidden Confluences, secret bosses, or future story reveals.
- **Owner/staff manual:** no operational change.

## Manual verification

1. Load the shell at desktop width and at approximately 390 px mobile width; confirm there is no horizontal overflow or clipped control.
2. Navigate interactive controls with the keyboard and confirm visible focus.
3. Open Sound settings. Audio should report locked before a player gesture requests activation.
4. Activate audio, play the calibration tone, change each volume channel, mute, then unmute. Existing channel levels should remain intact.
5. Reload. Saved levels and mute state should restore.
6. Confirm requested artwork/audio produces intentional fallback/request states rather than broken URLs or autoplay attempts.
