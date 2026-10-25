# Mobile Log and Battle Artwork Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give mobile log the timeline space, replace placeholder action art, and keep desktop chat draggable within visible bounds.

**Architecture:** Preserve the existing mounted log/timeline/chat and shared mobile media boundary. Extend the mobile reader over the reserved timeline row so the battlefield and footer do not move. Desktop chat measures the existing chrome boundary when fitting its window.

**Tech Stack:** React/TypeScript, CSS modules, Chromium production-component fixtures, Vitest, generated optimized WebP.

**Spec:** `docs/superpowers/specs/2026-10-24-mobile-log-art-design.md`

## Global constraints

- No combat, timing, privacy, history-fetch, environment/data/schema/catalogue changes.
- Preserve single44px mobile footer and unchanged battlefield; desktop log unchanged.
- Retain `git.deploymentEnabled["**"] = false`; no previews, one final verified production.

## Review focus

- Long/multi-round logs keep explicit expansion/reading state across toggles and rotation.
- Short coarse landscape retains an accessible toggle and complete final log entry.
- Spectators receive the same mobile log layout without combat controls.
- Chat stays reachable after dragging to every edge and after resizing; draft survives.
- Unknown recorded events use neutral art; existing Skill identities retain their artwork.

### Task 1: Mobile reader

Files: `battle-mobile-layout.module.css`, `battle-log-chronicle.tsx`/CSS and `pvp-spectator-experience.tsx` under `apps/web/src/components/battle`; `apps/web/scripts/battle-command-feedback-browser-regression.mjs`.

- [x] Add a real-browser regression requiring hidden mobile heading/track, reader down to footer, reachable toggle, unchanged board/footer, retained history and spectator parity. Run against original source and record failure.
- [x] Scope styles to the existing mobile query; reuse the mounted log and toggle. Add spectator workspace markers without duplicating state.
- [x] Run the new regression and existing complete command-feedback browser matrix; inspect phone/landscape captures.

### Task 2: Desktop chat bounds

Files: `pvp-battle-chat-bridge.tsx` and the shared browser regression above.

- [x] Reproduce drag header hidden under chrome in desktop fixtures; test four edges, repeat drag, viewport resize and draft survival.
- [x] Fit the actual panel below visible site/battle headers and inside the viewport on drag/open/resize, preserving transport and mobile behaviour.
- [x] Run desktop and mobile chat guards.

### Task 3: Artwork and finalization

Files: `battle-chronicle-artwork.ts`, `battle-skill-presentation.ts`, adjacent artwork tests; new `apps/web/public/media/skills/*-dark-fantasy-v1.webp`; generation receipt in `docs/verification/2026-10-24-mobile-log-art.md`.

- [x] Generate three individual raster assets with the built-in image tool; inspect and optimize for the project.
- [x] Update identity tests first, observe their expected failure, then wire the three sources; verify browser decoding.
- [x] Review final diff, run format/lint/eight-package types/bounded full tests/build and full battle browser matrix; refresh main and reconcile if needed.
- [ ] Publish reviewed exact tree through expected-head GitHub connector, inspect fresh CI once and pause continuous polling. Release only when all gates pass.

### Owner follow-up: mobile Techniques note

Files: `character-skill-build-panel.tsx`/CSS; `management-mobile-browser-regression.mjs`.

- [x] Hide only the full-capacity note within the existing mobile media boundary.
- [x] Verify portrait/landscape Discipline2 at4/4: Equip remains disabled, count remains visible, reading issues no save. Existing complete Techniques picker matrix passes.
