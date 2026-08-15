# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative game-design document.
- `docs/LORE_BIBLE.md` is the authoritative lore expansion for Aurevane, the central goddess mystery, the Binding, the long-form antagonist reveal, and related narrative motifs. Do not casually alter or spoil its approved canon.
- `docs/PROGRESSION_RETENTION.md` is the authoritative feature expansion for the minimum six-month first-character journey, Horizon pacing, urgency/FOMO design, Rekindling prestige, Veteran Edge PvP constraints, lore discovery/Archive systems, and their Master Panel controls.
- `docs/MEDIA_PIPELINE.md` is the authoritative media/audio pipeline document.
- `docs/TECHNOLOGY_POLICY.md` is authoritative engineering guidance for language/runtime/toolchain selection; use modern stable/LTS production technology rather than blindly chasing previews or legacy stacks.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when they are added.
- Never redesign, remove, simplify, or invent game mechanics unless explicitly asked.
- Never rewrite major approved lore, Aurevane's identity/motivation, the reason for her imprisonment, or the central reveal without explicit owner approval.
- Never collapse the approved six-month progression journey, Horizon Gates, Rekindling model, Veteran Edge constraints, or lore-discovery loop into a short generic XP grind without explicit owner approval.
- Build one small ticket at a time. Implement only the requested ticket, do not implement future systems prematurely, and stop when that ticket is complete.
- Preserve working functionality unless explicitly replacing it.
- For major architectural changes, propose the plan before modifying code.
- Before significant architecture or implementation work, read the relevant authoritative documents in `docs/` and inspect the existing code before proposing changes.
- Before implementing character progression, XP/Mastery pacing, retention, events, seasons, prestige/Rekindling, PvP veteran rewards, Archive/lore discovery, player correction tools, or related Master Panel features, read `docs/PROGRESSION_RETENTION.md` in addition to the Game Master Plan.
- Before implementing narrative, world, quest, NPC, event, Soulmark, Confluence, region, Expedition, nation, or major media content that may touch the central mythology, read `docs/LORE_BIBLE.md` in addition to the Game Master Plan.
- Never assume a system, package, database table, route, or feature exists; verify it in the repository.

## Server authority and security

- All authoritative game state must be server-side. The browser may request actions, but it must never determine authoritative combat, rewards, XP, currency, inventory, progression, PvP, trading, quest outcomes, cooldowns, Rekindling state, Veteran Edge state, lore discovery, permissions, or other persistent state.
- Validate all external input server-side. Privileged operations require server-side authorization; hidden UI elements are never security controls.
- Use transactions for multi-step authoritative state changes.
- Never expose server secrets, service-role credentials, database credentials, or privileged keys to client code or `NEXT_PUBLIC_*` environment variables.
- Never import server-only database, authorization, or privileged game logic into Client Components.
- Owner power is implemented through explicit authoritative commands, permissions, validation, audit records, and break-glass workflows where required—not by exposing raw production credentials to the browser.

## Architecture and data

- Prefer modular, feature-oriented architecture. Keep UI, domain/game logic, database access, validation, and authorization clearly separated.
- Avoid giant files and giant routers.
- Use migrations for every database change.
- Progression curves, Horizon Gates, Rekindling rules, Veteran Edge definitions, event/urgency settings, lore Fragment Sets, and other live-operated balance data should be data-driven/versioned where practical so the Master Panel can safely tune them later.
- TypeScript is the default application/game-service language and PostgreSQL/SQL is the authoritative relational data layer unless a documented architectural decision justifies another production language.
- New framework/runtime/compiler majors must be verified against current authoritative documentation and introduced deliberately through focused migration work rather than incidental gameplay tickets.

## Narrative and live-world continuity

- The permanent character-building loop and the living-world story must reinforce each other.
- The central Aurevane mystery should unfold through fair foreshadowing, conflicting historical perspectives, player relationships, world events, and controlled story stages rather than an exposition dump.
- Lore must be discoverable through the world itself: documents, inscriptions, relics, environmental storytelling, NPC testimony, Archive Fragment Sets, events, Expeditions, and contradictory historical sources as defined in `docs/PROGRESSION_RETENTION.md` and `docs/LORE_BIBLE.md`.
- Do not reveal late-story secrets in early quests, public UI copy, item descriptions, art filenames, API payloads, logs visible to players, or event metadata merely because the internal lore is known to the implementation agent.
- Story/world-event content should be data-driven and versioned where practical so long-running live narrative can evolve without routine code deployments.
- Do not make every system secretly originate from Aurevane. The world must remain larger than the central antagonist.

## Retention and competitive integrity

- AUREVANE intentionally uses time-limited live events, seasons, first-witness recognition, rotating encounters, community races, and other experiential urgency to make the world feel worth returning to.
- Retention pressure should primarily create "I wish I had been there" through world history, social participation, cosmetics, titles, discovery, and changing activity—not permanent competitive inferiority for missing a short window.
- Do not add mandatory daily energy, destructive login streaks, pay-to-avoid-loss mechanics, or one-time exclusive meta-defining combat power.
- The first full character journey must remain a minimum approximately 180-day progression path under production defaults, with both calendar and gameplay milestone requirements.
- Rekindling is a voluntary repeated long-form rebuild, not deletion of character identity/history.
- Veteran Edge may matter in PvP but must remain bounded, data-driven, non-stacking in standard play, measurable, disableable, and tunable from the Master Panel.

## Owner / Master Panel direction

- The Owner is the highest game-operations authority and must eventually be able to operate, rebalance, publish, repair, and delegate the live game through `/master`.
- The Owner must be able to grant/revoke staff roles, granular permissions, special account capabilities/entitlements, and perform audited player corrections through authoritative domain commands.
- Progression, Horizon pacing, XP/Mastery curves, retention/event cadence, Rekindling, Veteran Edge, PvP queue rules, lore discovery/reveal thresholds, economy/content configuration, and player support corrections must all be planned for Master Panel control as their systems are implemented.
- Staff receive least privilege. Owner actions are audited too.

## Media and originality

- Art, music, SFX, ambience, and visual presentation are first-class product requirements.
- Production gameplay must not depend directly on a specific AI-generation model. AI-generated media requires review and approval before production use.
- Do not copy proprietary game code, copyrighted characters, lore, dialogue, music, art, maps, or other protected content.
- `https://www.theninja-rpg.com/` may be used only as an abstract presentation/UX quality benchmark. Never copy its implementation, assets, wording, characters, setting, or proprietary layout.

## Verification and handoff

- After code changes, run relevant type checks, linting, and tests. Never claim completion when checks fail.
- Clearly report every manual action the project owner must perform, explaining required steps plainly because the owner is a beginner programmer.
- For each completed implementation ticket, summarize what changed, tests run, required manual actions, and recommend a Git checkpoint.
