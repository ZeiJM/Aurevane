# Approved AUREVANE concept implementation

Owner approval: the Owner loved the complete 29-screen concept set, requested implementation exactly, authorized generation of all necessary artwork/assets, and requested the completed implementation for review. This is a presentation implementation of the current game, not authorization to deploy to Vercel.

## Visual contract

The character profile concept is the style anchor: ink navy framing, slim vertical navigation, original atmospheric moonlit city artwork, a strong character portrait, warm pale moonstone information surfaces, readable charcoal text, literary serif titles and clean sans body text, fine aged-gold rules, restrained teal controls and violet magic. Use clean surfaces rather than noisy parchment, small precise ornament rather than huge frames, and meaningful compact density rather than a dashboard of floating generic cards. All 29 concepts are approved visual references. Their generated text and numerical values are illustrative; the existing source code and current game rules remain authoritative.

The game shell has Profile, Battle Hall, Passive Training, and Adventurers in its rail, persistent character identity below, compact brand/public/account controls above. Public/auth/creation/roster screens have the same brand language with layouts appropriate to their context. Mobile uses intentional stacked layouts and accessible navigation, never a scaled desktop screenshot. Desktop gameplay must remain readable at 1366×768 and mobile at 390×844. Preserve visible focus, touch targets, reduced motion, and descriptive control labels.

## Functional contract

Preserve every current route, actual server handler, authorization boundary, character data, mutation, disabled feature, privacy rule, and game mechanic. Do not invent matchmaking, shops, guilds, queues, news posts, portraits uploads, social actions, or account recovery endpoints. Profile is the build headquarters; battles use committed builds. Four ordinary skill slots remain distinct from a pure build's Essence or a mixed build's passive Resonance. Battle geometry, targeting legality, AP, turn timing, controls, logs, and participant/spectator mechanics remain real and authoritative. UI appearance changes apply through shared battle presentation to AI, PvP and spectator modes.

## Screens

Profile overview; disciplines; Atlas/mastery; skills/Resonance; pure skills/Essence; attributes; passive training; Battle Hall AI; Battle Hall PvP; lobby; playable battle; spectate entry; spectator battle; results/log; online presence; all adventurers; public profile; account roster; creation identity; creation Discipline; creation confirmation; portrait/title; controls; login; News empty; News article template; Manual hub; Manual article; Rules.

## Assets

Owner continuation, 2026-09-13: the supplied Spectator Battle reference is pixel-identical to concept 13 (`exec-83209fb1-3991-44a8-9462-8c5144902fc4.png`), confirming this same 29-image suite. Environmental backgrounds must contain scenery rather than people. Retain the approved anime dark-fantasy art direction for any new assets; character portraits and battlefield units remain in their dedicated identity slots.

Generate original production illustrations, with no baked-in controls/text, derived from the approved concepts. At minimum: moonlit spire city, ruined training cloister, Battle Hall courtyard, archive interior, and four distinct starter character portraits. Reuse the already functional skill and Discipline art families. Record generation provenance and produce compressed runtime images with deliberate desktop/mobile crops. Integrate through the media registry. Respect custom portrait URLs and fallback behavior. This branch is the Owner's review candidate, with no automatic production publication.

## Review evidence

Run the repository quality gate and inspect actual desktop/mobile renders. Where backend credentials are unavailable, use a development-only isolated visual harness of actual components with representative fixtures; do not weaken production authorization or imply authenticated/backend flows were verified. Record any unavailable checks precisely. Supply source, generated assets, screenshots, and a reviewable branch/PR or self-contained review artifact.
