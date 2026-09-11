# Phase 4 media candidates — set 01

**Candidate only. Human art/listening review and production approval are pending.**

Ten painted Discipline identity masters and 72 short sound candidates cover the ten advanced traditions. The art is a reusable identity family, not 80 bespoke Skill paintings. Three regular and three Essence cues per Discipline are supplemented by three each for attrition, healing, cleanse and Resonance conversion. Pair-specific sound mixing and full Skill illustration coverage remain review/integration work; this pack does not claim 105 finished Resonance sound mixes.

## Provenance

- Art: OpenAI built-in image generation, original prompts in `art-manifest.json`, no source/reference images or named-artist/franchise imitation. Original full-resolution PNGs were generated in the conversation and retained there. The repository keeps high-quality WebP review masters, their original PNG hashes and deterministic 64/128/256 px review encodes. These are candidates, not approved runtime assets.
- Audio: original internal material synthesis in `scripts/media/render_phase4_audio.py`, deterministic seeds, no recordings, samples, melodies or outside asset licenses. PCM WAV masters and MP3 review encodes are retained with SHA-256 provenance. The synthesis method does not imply listening acceptance.
- All `approvedBy` values remain null. Neither this branch nor the review packet changes the live catalog's media relationships.

## Review packet

Run `node scripts/media/build_phase4_review.mjs /absolute/output/phase4-media-review.html` after installing the repository's existing dependencies. This creates one self-contained HTML file with artwork comparisons, full-size images, all cue variations, master/SFX levels, mute, stop, notes and local JSON export. No network request, provider call or account access is needed. It uses the central AudioDirector's explicit candidate-audition path; ordinary playback still rejects candidate assets.

Review notes are not publication authority. Follow `docs/MEDIA_PIPELINE.md`: human review, approved source selection, final derivative review, stable asset registration, representative game integration and production approval. Do not set candidate statuses to approved merely to make playback work.

## Budgets and validation

- 256 px icon encodes are below 18 KB; all icon derivatives are below the 40 KB target.
- All 72 mono MP3 cues are below 8 KB each, below the 20 KB target. Source durations are 160–340 ms for regular cues and 540 ms for Essences.
- Source peaks are at or below −10 dBFS. Regular/Essence RMS targets match; attrition is quieter. Encoded peak/duration checks are recorded in `validation.json`.
- Central playback has a two-SFX voice cap, priority preservation, gesture unlock, mute/zero-level rejection, hidden-tab rejection and cancellation of stopped pending playback. These have focused automated tests.
- Automated checks do not establish art quality, listening comfort or tactical balance. Use the gallery and `docs/PHASE_4_PLAYTEST_PACKET.md` for human review.

Audio regeneration: `python scripts/media/render_phase4_audio.py` (offline numpy/scipy and ffmpeg). Art cannot be regenerated identically from a prompt; retain the selected masters and provenance. The review encodes and masters are intentionally outside `apps/web/public` and are not part of the production page bundle.
