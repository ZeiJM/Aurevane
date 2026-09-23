# AUDIO-A07-001 — Distinct Discipline battle audio v02

STATUS: IMPLEMENTATION READY FOR VERIFICATION — Owner listening acceptance remains open.

## Trigger

During A07 closeout on 2026-09-22, the Owner confirmed that battle audio playback works but reported that the existing Discipline sounds all sound the same. This supersedes any assumption that technical asset uniqueness or different file hashes are sufficient listening-quality evidence.

## Goal

Produce a current battle-audio pack in which the 17 published Disciplines are perceptually distinguishable during ordinary play without becoming loud, fatiguing or mechanically informative beyond the existing visual/gameplay channels.

Legacy `v01` assets remain addressable for compatibility. Current Discipline battle playback moves to `v02`. Shared attrition, healing, cleanse and Resonance accents remain on their existing `v01` families.

## Current v02 families

| Discipline | Intended audible identity |
|---|---|
| Vanguard | armored weapon impact; low body with brief metal contact |
| Farstrider | taut bowstring/pluck with short arrow-flight whistle |
| Shadehand | muted blade whisper, cloth and low transient |
| Aetherist | rising arcane chirp, glass resonance and sparse sparks |
| Lifebinder | warm organic pulse, wood/leaf release and soft overtone |
| Ironfist | padded wrapped-fist contact and cloth movement |
| Chronist | measured clockwork ticks and suspended glass |
| Bastion | deep shield brace, sub impact and controlled metal bloom |
| Ravager | serrated heavy cut, scrape and restrained low growl |
| Edgedancer | bright precise slice, high transient and fast whoosh |
| Wildwarden | wooden string/pluck, brush and twig/thorn accents |
| Runeblade | steel contact plus stable rune resonance |
| Dawnshield | shield body plus warm radiant tonal bloom |
| Cinderweaver | dry crackle/ignition plus short flame-noise release |
| Frostweaver | brittle high ice fracture and crystal ring |
| Stormsinger | low thunder body, sharp charged snap and rising charge |
| Tidecaller | water impact, filtered splash and falling fluid pitch |

## Technical standard

- deterministic internal material synthesis only; no external recordings/samples;
- mono 48 kHz source synthesis;
- deterministic build-time 16-bit PCM WAV runtime files;
- three compatible variants per Discipline role;
- regular action cues remain short one-shots; Essences are more articulated, not merely louder;
- normalized non-clipping output; runtime WAV files remain under 65 KB each;
- no gameplay mechanic relies on sound alone;
- central AudioDirector volume/mute/gesture behavior remains unchanged;
- no preview/history/reconnect catch-up playback.

## Perceptual-difference rule

A family is not considered acceptable merely because its waveform or hash differs. The synthesis architecture must differ materially through combinations of transient shape, frequency band, decay envelope, pitch motion, noise/material layer and Essence articulation. The Owner's actual listening review remains the acceptance gate.

## Runtime/audition behavior

- battle playback uses current `v02` action/Essence assets for all 17 published Disciplines;
- Master Panel audio audition resolves current regular Skills to action `v02` and current Essences to Essence `v02`;
- legacy `v01` assets remain registered for compatibility;
- shared attrition/healing/cleanse/Resonance cues remain `v01`.

## Acceptance

Automated checks may prove registry completeness, generated-file delivery, WAV validity, build/browser safety and deterministic generation. They do **not** close A07. A07 closes only after Owner listening review confirms the new families are suitably distinct and usable in battle.
