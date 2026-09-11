# AUDIO-DISC-001 — Phase 4 combat cue families

TYPE: Discipline / Skill / Essence / Resonance SFX
STATUS: REQUESTED — authored hooks exist; dedicated recordings are not delivered or approved.
CONTEXT: confirmed combat actions on the shared PvE/PvP/spectator platform
TRIGGER: committed action/effect events only; never previews, initial snapshot hydration, reconnect history or duplicate versions
PERSPECTIVE: restrained board-local, mono-compatible
DURATION: regular actions 100–350 ms; signatures up to 600 ms
VARIATION COUNT: three subtle compatible variants per family
COMPETING SOUNDS: shared UI confirmation, later music/ambience; cap two concurrent action cues, prioritize confirmed player action

| Discipline | Transient / body | Avoid |
|---|---|---|
| Bastion | muted shield thud / low metal | long ringing clang |
| Ravager | coarse cut / brief breath | excessive gore |
| Edgedancer | precise slice / light metal | heavy axe identity |
| Wildwarden | string snap / thorn brush | gunshot |
| Runeblade | blade contact / short rune resonance | electronic bleep |
| Dawnshield | warm shield resonance / soft air | ornate choir |
| Cinderweaver | dry ignition / short flame | continuous roaring |
| Frostweaver | ice tick / brittle fracture | piercing glass |
| Stormsinger | restrained crack / air displacement | loud thunder boom |
| Tidecaller | water impact / flowing release | constant bubbling |

Essences strengthen their own identity without simply increasing volume. Resonances use a short conversion accent between the two identities, not two full cues stacked. Burn/Bleed/Poison ticks share a subdued attrition family; cleansing and healing have distinct releases. No mechanic relies on sound alone.

RUNTIME: central AudioDirector, existing master/SFX settings and gesture unlock. Suspend cues in hidden tabs, deduplicate committed battle versions, never queue historical playback. Each runtime variation targets at most 20 KB; no generation/network vendor call during combat. At most ten advanced families plus shared effect accents, rather than 195 unrelated audio assets.
DELIVERABLES: source masters, normalized runtime files, provenance and listening review; Art/Audio Bible human acceptance is pending. No approval or recordings are inferred from a stable audioCueKey.
