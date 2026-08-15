# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative game-design document.
- `docs/MEDIA_PIPELINE.md` is the authoritative media/audio pipeline document.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when they are added.
- Never redesign, remove, simplify, or invent game mechanics unless explicitly asked.
- Build one small ticket at a time. Implement only the requested ticket, do not implement future systems prematurely, and stop when that ticket is complete.
- Preserve working functionality unless explicitly replacing it.
- For major architectural changes, propose the plan before modifying code.
- Before significant architecture or implementation work, read the relevant authoritative documents in `docs/` and inspect the existing code before proposing changes.
- Never assume a system, package, database table, route, or feature exists; verify it in the repository.

## Server authority and security

- All authoritative game state must be server-side. The browser may request actions, but it must never determine authoritative combat, rewards, XP, currency, inventory, progression, PvP, trading, quest outcomes, cooldowns, or other persistent state.
- Validate all external input server-side. Privileged operations require server-side authorization; hidden UI elements are never security controls.
- Use transactions for multi-step authoritative state changes.
- Never expose server secrets, service-role credentials, database credentials, or privileged keys to client code or `NEXT_PUBLIC_*` environment variables.
- Never import server-only database, authorization, or privileged game logic into Client Components.

## Architecture and data

- Prefer modular, feature-oriented architecture. Keep UI, domain/game logic, database access, validation, and authorization clearly separated.
- Avoid giant files and giant routers.
- Use migrations for every database change.

## Media and originality

- Art, music, SFX, ambience, and visual presentation are first-class product requirements.
- Production gameplay must not depend directly on a specific AI-generation model. AI-generated media requires review and approval before production use.
- Do not copy proprietary game code, copyrighted characters, lore, dialogue, music, art, maps, or other protected content.
- `https://www.theninja-rpg.com/` may be used only as an abstract presentation/UX quality benchmark. Never copy its implementation, assets, wording, characters, setting, or proprietary layout.

## Verification and handoff

- After code changes, run relevant type checks, linting, and tests. Never claim completion when checks fail.
- Clearly report every manual action the project owner must perform, explaining required steps plainly because the owner is a beginner programmer.
- For each completed implementation ticket, summarize what changed, tests run, required manual actions, and recommend a Git checkpoint.
