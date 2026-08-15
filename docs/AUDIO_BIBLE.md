# AUREVANE — Audio Bible

**Status:** Authoritative audio specification

This document governs music, ambience, sound effects, voice-adjacent presentation, runtime mixing, accessibility, production workflow, and audio asset review for AUREVANE.

The Master Game Plan defines the game. This Audio Bible defines how AUREVANE should sound.

## 1. Audio North Star

AUREVANE should sound like a premium tactical fantasy RPG built for long play sessions.

The audio experience should be immersive, memorable, responsive, and restrained enough that players can remain in the game for hours without fatigue. Music should support exploration, discovery, tension, mastery, cooperation, rivalry, and danger. Sound effects should make actions readable and satisfying. Ambience should make locations feel inhabited rather than silent menu backdrops.

The target is not constant cinematic bombast. Quiet moments must exist so important moments have room to become powerful.

## 2. Core Principles

1. **Gameplay information comes first.** Important combat events must be audible even when music and ambience are active.
2. **Every sound has a purpose.** Avoid filling the mix with noise merely to make it feel busy.
3. **Intensity is earned.** Bosses, Confluences, Soulmark awakenings, critical states, ranked victories, and major world events may receive stronger audio treatment.
4. **Disciplines have sonic identity.** Players should begin recognizing combat styles by sound as well as by visuals.
5. **Regions have environmental identity.** Wind, wildlife, settlement activity, machinery, water, weather, architecture, and supernatural phenomena define place.
6. **Music supports long sessions.** Loops must avoid obvious repetition fatigue.
7. **Audio remains optional and accessible.** Music, SFX, ambience, and UI audio require independent user control.
8. **Production is provider-independent.** The game must never require a specific AI music or SFX generator at runtime.
9. **Originality and provenance are mandatory.** Never imitate copyrighted game music or living composers by name.
10. **Silence is part of the design.** Do not layer every possible sound at once.

## 3. Audio Categories

AUREVANE uses at minimum:

- music;
- ambience;
- combat SFX;
- ability SFX;
- movement SFX;
- UI SFX;
- world-interaction SFX;
- creature SFX;
- boss SFX;
- reward/progression stingers;
- social/notification SFX;
- cinematic/event cues.

Each asset must belong to a defined category for mixing and user settings.

## 4. Music System

Music is context-driven and should be designed for adaptive playback rather than a single endless playlist.

Primary music contexts include:

- login/title;
- character creation;
- town/hub;
- wilderness exploration;
- dangerous exploration;
- story/narrative;
- ordinary tactical combat;
- elite combat;
- boss combat;
- expedition exploration;
- expedition danger;
- Deep Expedition escalation;
- casual PvP;
- ranked PvP;
- tournament/high-stakes PvP;
- guild/social spaces;
- nation conflict;
- major world events;
- victory/reward;
- defeat/recovery.

## 5. Adaptive Music

Where practical, long-form gameplay music should be authored in compatible layers or stems.

Recommended stem families:

- ambient/harmonic bed;
- rhythmic/percussion layer;
- melodic identity layer;
- tension layer;
- climax layer.

The runtime may raise or lower layers based on state, for example:

- entering combat;
- boss phase change;
- low party health;
- expedition threat escalation;
- PvP final-round pressure;
- rare discovery;
- major Confluence activation.

Transitions should favor musical continuity over hard restarts. Crossfades, quantized transitions, or compatible loop boundaries should be used where feasible.

## 6. Region Music Identity

Regions should have musical identity without becoming caricatures of real-world cultures.

A regional music specification should define:

- primary emotional character;
- instrumentation family;
- rhythmic density;
- harmonic language;
- tempo range;
- environmental integration;
- prohibited clichés;
- exploration and danger variants.

Do not use superficial ethnic signifiers as shortcuts for worldbuilding.

## 7. Discipline Sonic Identity

Every Discipline requires a reusable sound language.

The specification should cover:

- attack transients;
- power-source texture;
- movement signature;
- impact character;
- sustain/release behavior;
- preferred frequency emphasis;
- elements to avoid because they belong to other Disciplines.

Examples of abstract distinctions:

- a defensive Discipline may emphasize weight, resonance, shield/metal body, and controlled low-frequency impact;
- a temporal Discipline may use precise ticks, reversals, granular tails, and controlled spatial movement;
- a storm Discipline may use electrical crack, air displacement, distant thunder body, and rapid transient detail;
- an illusion Discipline may emphasize doubled localization, filtered reflections, phase shifts, and short impossible tails.

These are conceptual rules, not fixed samples.

## 8. Confluence Audio

Confluences should sound like interactions between two established systems.

A good Confluence cue should answer:

1. What triggered?
2. Which two combat identities interacted?
3. What new result occurred?

Avoid merely stacking two full ability sounds at equal volume. Author or mix a distinct interaction layer so the mechanic feels intentional.

Major Confluence Arts may receive a short signature stinger layered into the ability SFX, but it must not obscure combat readability.

## 9. Soulmark Audio

Soulmarks should sound supernatural and identity-defining, distinct from ordinary Discipline magic.

Each Soulmark requires:

- activation signature;
- passive-state motif where appropriate;
- high-power expression;
- cooldown/availability cue if important;
- interaction rules with music and combat SFX.

Soulmark audio may be stranger and more spatial than Discipline audio, but must remain comfortable in headphones.

## 10. Tactical Combat Mix Priority

When many sounds occur simultaneously, priority should generally be:

1. immediate danger and player-targeted warnings;
2. confirmed player action;
3. major enemy action / boss telegraph;
4. Confluence or Soulmark event;
5. ordinary attacks and impacts;
6. persistent zones/status loops;
7. ambience;
8. music detail layers.

Music may duck subtly beneath critical telegraphs. Repeated low-value combat sounds should use concurrency limits and variation.

## 11. SFX Variation

Frequently repeated actions require variation to prevent fatigue.

Variation may include:

- multiple source recordings/renders;
- pitch variation within safe limits;
- volume variation;
- alternate transient layers;
- round-robin selection;
- surface-specific variants;
- distance filtering.

Do not make every button click, footstep, sword impact, heal, or spell identical for hundreds of hours.

## 12. Movement and Terrain

Movement audio should support the tactical board without becoming noisy.

Where useful, footsteps and movement should vary by:

- stone;
- dirt;
- grass;
- wood;
- snow/ice;
- shallow water;
- metal;
- supernatural surfaces.

Movement Arts may suppress or transform ordinary footstep logic.

## 13. Creature and Boss Audio

Creature families should share recognizable vocal/material traits.

Bosses require stronger sonic hierarchy, including some combination of:

- entrance cue;
- mechanic telegraph;
- phase-change cue;
- signature attack cue;
- enrage/final-phase treatment;
- defeat release.

Important boss telegraphs must remain recognizable even with music disabled.

## 14. UI Audio

UI sound should be tactile, concise, and restrained.

Recommended distinct states:

- hover only where valuable;
- confirm/select;
- cancel/back;
- tab/navigation change;
- invalid action;
- item acquired;
- equipment changed;
- Discipline mastery milestone;
- Confluence discovered;
- Soulmark unlocked;
- matchmaking found;
- message/party invite;
- ranked result.

Avoid loud or ornate sounds for routine navigation.

## 15. Ambience

Ambience makes persistent browser screens feel like places rather than pages.

Ambience systems should combine long beds with sparse randomized one-shots rather than one obvious repeating file.

Examples:

- town crowd beds with distant trade/work detail;
- forest wind, canopy movement, insects, distant fauna;
- crypt air, stone resonance, debris, distant structural creaks;
- coastal surf, rigging, gulls, dock activity;
- magical regions with restrained anomalous textures.

Ambience must duck or simplify during information-dense combat when necessary.

## 16. Loudness and Dynamics

Audio assets should be normalized through a consistent production standard before integration.

Avoid extreme loudness differences between:

- UI and combat;
- ordinary abilities and Ultimates;
- tracks;
- exploration and PvP;
- headphones and speakers.

Use dynamic range intentionally. Do not solve impact by making every new asset louder than the last.

Exact loudness targets should be established during implementation after testing the selected web audio pipeline and representative devices.

## 17. Runtime Audio Controls

Players require independent controls for at least:

- Master Volume;
- Music;
- Sound Effects;
- Ambience;
- UI Sounds.

Settings persist per account where appropriate and should also be available before login when technically practical.

Required controls:

- mute all;
- restore previous levels;
- reduced/disabled UI sounds;
- audio continues or pauses according to documented browser-focus policy;
- no unexpected autoplay that violates browser policies.

## 18. Accessibility

Critical mechanics must not rely on sound alone.

Important audio telegraphs require visual equivalents. Likewise, significant visual-only events should receive audio where that helps players who are not staring at one exact UI location.

Avoid dangerous or painful frequency spikes and excessive stereo movement. Spatial effects should not prevent players using mono audio from understanding gameplay.

## 19. Web Runtime Requirements

The audio architecture must anticipate:

- browser autoplay restrictions;
- asset preloading and streaming;
- cache behavior;
- route transitions;
- reconnects;
- mobile browsers;
- background tab behavior;
- user gesture initialization;
- concurrency limiting;
- voice stealing/priorities;
- music transitions;
- persistent user settings.

Audio must be controlled by a central runtime service rather than scattered direct `<audio>` calls throughout UI components.

## 20. Source and Runtime Assets

Keep production masters separate from game-ready files.

**Source master** → review → edit/mix/master → runtime encode → metadata registration → integration.

Possible runtime formats should be chosen based on browser support, quality, loop behavior, and file size. Do not commit huge uncompressed masters to the ordinary application bundle.

## 21. Audio Request Format

Missing audio creates an `AUDIO_REQUEST` in `content/audio-requests/`.

Example:

```text
AUDIO-EXP-003
TYPE: Music
CONTEXT: Deep Expedition — Frostmere Crypt
MOOD: mysterious, dangerous, ancient, gradually intensifying
STYLE: orchestral fantasy with restrained choir, bowed strings, low percussion, glassy textures
LOOP: yes
STEMS: ambient, rhythm, tension
AVOID: trailer music, modern EDM, cheerful melody, copyrighted-theme resemblance
LENGTH: long-loop gameplay track
DELIVERABLES: source master + runtime mix + optional stems
STATUS: REQUESTED
```

SFX requests should additionally specify trigger, duration, perspective, variation count, and competing sounds.

## 22. AI-Assisted Audio

AI may assist music or SFX production only through the controlled asset pipeline.

Rules:

- never call a generation provider from live gameplay;
- never make production dependent on one vendor;
- never request imitation of a living composer or copyrighted soundtrack;
- store prompt/specification and provenance metadata;
- review output for artifacts, clipping, incoherent loops, unwanted voices, recognizable borrowed melody, and licensing concerns;
- edit/master approved outputs before runtime use.

## 23. Provenance

Every externally sourced or generated production asset must record enough metadata to answer:

- where did it come from?
- when was it created/acquired?
- under what license/terms may it be used?
- what source/master produced this runtime file?
- who approved it?
- what edits were applied?

Unknown-provenance audio does not ship.

## 24. Naming

Examples:

```text
mus_region_frostmere_explore_v01.ogg
mus_expedition_frostmere_deep_tension_v02.ogg
amb_town_market_day_bed_v01.ogg
sfx_disc_bastion_shield_impact_01.ogg
sfx_confluence_arcflash_trigger_01.ogg
sfx_ui_confluence_discovered_v01.ogg
```

Names describe game identity and purpose, not the generation tool.

## 25. Review Checklist

Before approval:

- context and trigger are correct;
- sonic identity matches AUREVANE;
- no obvious copyrighted melody/sample imitation;
- mix works beneath/above expected competing layers;
- loop points are clean where required;
- repeated sounds have adequate variation;
- no clipping/clicks/unwanted silence;
- headphone playback is comfortable;
- mono compatibility is acceptable;
- file size and codec are appropriate;
- provenance is documented;
- critical gameplay event also has a visual cue.

## 26. Final Audio Identity

AUREVANE should have a soundscape players can recognize even with their eyes closed: tactile tactical impacts, distinct Discipline identities, uncanny Soulmarks, memorable Confluences, atmospheric regions, restrained but emotionally strong music, and clean UI feedback.

The goal is not simply to have music and sound. The goal is to make the browser feel like a living game world.
