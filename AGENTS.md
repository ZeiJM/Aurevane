# AUREVANE — Permanent Codex Guidance

## Project authority and scope

- The project is **AUREVANE**, an original persistent browser-based multiplayer RPG.
- `docs/GAME_MASTER_PLAN.md` is the authoritative game-design document.
- `docs/LORE_BIBLE.md` is the authoritative lore expansion for Aurevane, the central goddess mystery, the Binding, the long-form antagonist reveal, and related narrative motifs. Do not casually alter or spoil its approved canon.
- `docs/PROGRESSION_RETENTION.md` is the authoritative feature expansion for the minimum six-month first-character journey, Horizon pacing, urgency/FOMO design, Rekindling prestige, Veteran Edge PvP constraints, lore discovery/Archive systems, and their Master Panel controls.
- `docs/NATURAL_PACING.md` is the authoritative refinement for achieving the six-month journey through meaningful layered progression rather than generic timers. Where earlier planning language could be interpreted as a crude visible day-gate, follow the natural-pacing standard instead.
- `docs/OWNER_OVERRIDE.md` is the authoritative Master Panel expansion for protected Owner bypass grants, exceptional/nonstandard player state, special permissions, unearned grants, and Break-Glass God Mode.
- `docs/PLAYER_MANUAL.md` is the authoritative specification for the comprehensive player manual, contextual help, glossary, protected Owner/Staff operations manual, and documentation-update requirements.
- `docs/ENGINEERING_EXECUTION_STANDARD.md` is the authoritative cleanliness/efficiency refinement for all implementation work. Every coding ticket must favor the smallest clean solution that fully satisfies the requirement, avoids unnecessary complexity and waste, and leaves the repository easier to maintain.
- `docs/MEDIA_PIPELINE.md` is the authoritative media/audio pipeline document.
- `docs/TECHNOLOGY_POLICY.md` is authoritative engineering guidance for language/runtime/toolchain selection; use modern stable/LTS production technology rather than blindly chasing previews or legacy stacks.
- Treat `docs/ART_BIBLE.md` and `docs/AUDIO_BIBLE.md` as authoritative when they are added.
- Never redesign, remove, simplify, or invent game mechanics unless explicitly asked.
- Never rewrite major approved lore, Aurevane's identity/motivation, the reason for her imprisonment, or the central reveal without explicit owner approval.
- Never collapse the approved six-month progression journey, natural Horizon progression, Rekindling model, Veteran Edge constraints, or lore-discovery loop into a short generic XP grind or generic timer farm without explicit owner approval.
- Build one small ticket at a time. Implement only the requested ticket, do not implement future systems prematurely, and stop when that ticket is complete.
- Preserve working functionality unless explicitly replacing it.
- For major architectural changes, propose the plan before modifying code.
- Before every meaningful coding/implementation ticket, read `docs/ENGINEERING_EXECUTION_STANDARD.md` together with the applicable authoritative documents and inspect the existing code before proposing or writing changes.
- Before significant architecture or implementation work, read the relevant authoritative documents in `docs/` and inspect the existing code before proposing changes.
- Before implementing character progression, XP/Mastery pacing, retention, events, seasons, prestige/Rekindling, PvP veteran rewards, Archive/lore discovery, player correction tools, or related Master Panel features, read `docs/PROGRESSION_RETENTION.md` and `docs/NATURAL_PACING.md` in addition to the Game Master Plan.
- Before implementing Owner/player modification tools, special grants, staff powers, entitlements, exceptional character state, or Break-Glass actions, read `docs/OWNER_OVERRIDE.md` and `docs/MASTER_PANEL.md`.
- Before implementing any player-facing feature or materially changing an existing mechanic, review `docs/PLAYER_MANUAL.md` and include the documentation impact required by that specification.
- Before implementing narrative, world, quest, NPC, event, Soulmark, Confluence, region, Expedition, nation, or major media content that may touch the central mythology, read `docs/LORE_BIBLE.md` in addition to the Game Master Plan.
- Never assume a system, package, database table, route, or feature exists; verify it in the repository.

## Server authority and security

- All authoritative game state must be server-side. The browser may request actions, but it must never determine authoritative combat, rewards, XP, currency, inventory, progression, PvP, trading, quest outcomes, cooldowns, Rekindling state, Veteran Edge state, lore discovery, permissions, Owner overrides, or other persistent state.
- Validate all external input server-side. Privileged operations require server-side authorization; hidden UI elements are never security controls.
- Use transactions for multi-step authoritative state changes.
- Never expose server secrets, service-role credentials, database credentials, or privileged keys to client code or `NEXT_PUBLIC_*` environment variables.
- Never import server-only database, authorization, or privileged game logic into Client Components.
- Owner power is implemented through explicit authoritative commands, permissions, validation, audit records, provenance metadata, and Break-Glass workflows where required—not by exposing raw production credentials to the browser.
- Owner override may deliberately bypass normal acquisition/eligibility rules, but it must not silently corrupt hard persistence/runtime invariants. If a desired state requires a supported exceptional-state representation, content rule, or isolated sandbox, implement that deliberately.

## Architecture, cleanliness, and data

- Prefer modular, feature-oriented architecture. Keep UI, domain/game logic, database access, validation, and authorization clearly separated.
- Implement the smallest coherent change that completely satisfies the current ticket. Do not turn a feature ticket into unrelated architecture churn, broad formatting changes, or speculative future scaffolding.
- Reuse or extend existing services, schemas, components, validators, and patterns when they already own the behavior. Do not create parallel `V2`, `New`, `Better`, or duplicate implementations because the repository was not inspected first.
- Avoid giant files and giant routers, but also avoid excessive fragmentation. A file/module should have a clear responsibility and every abstraction should earn its existence.
- Keep one authoritative source of truth for game rules and live configuration. Do not duplicate formulas, permissions, balance values, unlock requirements, validation, or authoritative calculations across layers.
- Remove obsolete/dead/debug code when replacement is complete and safe. Do not leave abandoned branches, duplicate helpers, commented-out implementations, stray logs, or unused exports behind.
- Avoid unnecessary dependencies. Prefer maintained platform/framework capabilities or existing project libraries when they solve the problem cleanly.
- Use migrations for every database change.
- Database and network work must be bounded and intentional: avoid obvious N+1 queries, unbounded reads, redundant round trips, oversized payloads, duplicate subscriptions, and expensive client polling when a cleaner architecture exists.
- Keep client JavaScript/state/hydration no larger than necessary. Use small Client Component boundaries, derived state, and server-side work where appropriate rather than moving logic client-side for convenience.
- Progression curves, Horizon milestones, Rekindling rules, Veteran Edge definitions, event/urgency settings, lore Fragment Sets, documentation metadata, and other live-operated balance data should be data-driven/versioned where practical so the Master Panel can safely tune them later.
- Schemas should preserve provenance for support/Owner-granted exceptional state where appropriate and must not assume every valid represented state came through ordinary player acquisition.
- TypeScript is the default application/game-service language and PostgreSQL/SQL is the authoritative relational data layer unless a documented architectural decision justifies another production language.
- New framework/runtime/compiler majors must be verified against current authoritative documentation and introduced deliberately through focused migration work rather than incidental gameplay tickets.
- Optimize meaningful bottlenecks with evidence where possible; do not trade readability for speculative micro-optimization.

## Narrative and live-world continuity

- The permanent character-building loop and the living-world story must reinforce each other.
- The central Aurevane mystery should unfold through fair foreshadowing, conflicting historical perspectives, player relationships, world events, and controlled story stages rather than an exposition dump.
- Lore must be discoverable through the world itself: documents, inscriptions, relics, environmental storytelling, NPC testimony, Archive Fragment Sets, events, Expeditions, and contradictory historical sources as defined in `docs/PROGRESSION_RETENTION.md` and `docs/LORE_BIBLE.md`.
- Do not reveal late-story secrets in early quests, public UI copy, item descriptions, art filenames, API payloads, logs visible to players, manual articles, or event metadata merely because the internal lore is known to the implementation agent.
- Story/world-event content should be data-driven and versioned where practical so long-running live narrative can evolve without routine code deployments.
- Do not make every system secretly originate from Aurevane. The world must remain larger than the central antagonist.

## Retention, pacing, and competitive integrity

- AUREVANE intentionally uses time-limited live events, seasons, first-witness recognition, rotating encounters, community races, and other experiential urgency to make the world feel worth returning to.
- Retention pressure should primarily create "I wish I had been there" through world history, social participation, cosmetics, titles, discovery, and changing activity—not permanent competitive inferiority for missing a short window.
- Do not add mandatory daily energy, destructive login streaks, pay-to-avoid-loss mechanics, or one-time exclusive meta-defining combat power.
- The first full character journey must remain a minimum approximately six-month progression path under production defaults, but the duration should come from layered meaningful progression and live-world cadence rather than visible generic timers.
- Horizons are progression eras/milestone bundles first. Player-facing unlock explanations should emphasize accomplishments and requirements, not arbitrary day countdowns.
- A calendar-age floor, if retained at all, is an administrative pacing backstop rather than the primary progression mechanic.
- Repetitive low-risk grind should not be the optimal way to bypass the game's breadth. Reward varied skilled play, mastery challenges, world/story progress, Expeditions, and build development.
- Rekindling is a voluntary repeated long-form rebuild, not deletion of character identity/history and not a generic 180-day waiting loop.
- Veteran Edge may matter in PvP but must remain bounded, data-driven, non-stacking in standard play, measurable, disableable, and tunable from the Master Panel.
- Characters carrying gameplay-affecting exceptional Owner overrides should not silently enter standard ranked PvP unless the state is explicitly permitted/normalized.

## Owner / Master Panel direction

- The Owner is the highest game-operations authority and must eventually be able to operate, rebalance, publish, repair, and delegate the live game through `/master`.
- The Owner must be able to grant/revoke staff roles, granular permissions, special account capabilities/entitlements, and perform audited player corrections through authoritative domain commands.
- The protected Owner must also be able to deliberately grant things that were not earned, bypass normal eligibility/acquisition rules, grant hidden/retired/internal registered content where safe, create exceptional test/event/support states, and use narrowly modeled Break-Glass God Mode actions as defined in `docs/OWNER_OVERRIDE.md`.
- Progression, Horizon pacing, XP/Mastery curves, retention/event cadence, Rekindling, Veteran Edge, PvP queue rules, lore discovery/reveal thresholds, economy/content configuration, manual publication, and player support/override corrections must all be planned for Master Panel control as their systems are implemented.
- Warnings should inform high-risk Owner actions, not silently remove Owner authority. Hard integrity constraints still require a representable safe state.
- Staff receive least privilege. Owner actions are audited too.

## Manual and player-help quality

- AUREVANE must maintain a comprehensive, attractive, searchable, spoiler-safe manual as a first-class product feature.
- Complex systems should use progressive disclosure: quick answer, practical guide, and deep mechanics.
- Contextual help should link from the game UI to exact relevant manual sections.
- Official terminology and glossary definitions must remain consistent across UI, tutorial, manual, and error messages.
- Where practical, render exact current requirements/rules from authoritative structured game configuration rather than duplicating numbers manually.
- Every implementation ticket that introduces or materially changes a player-facing mechanic must include a `DOCUMENTATION IMPACT` section identifying manual/contextual-help/glossary/visual/staff-operations updates.
- Major features are not polished-complete until required manual content is correct, readable, attractive, accessible, and spoiler-safe.
- Staff/Owner operational documentation must remain protected from public players.

## Media and originality

- Art, music, SFX, ambience, and visual presentation are first-class product requirements.
- Production gameplay must not depend directly on a specific AI-generation model. AI-generated media requires review and approval before production use.
- Do not copy proprietary game code, copyrighted characters, lore, dialogue, music, art, maps, or other protected content.
- `https://www.theninja-rpg.com/` may be used only as an abstract presentation/UX quality benchmark. Never copy its implementation, assets, wording, characters, setting, or proprietary layout.

## Verification and handoff

- After code changes, run relevant type checks, linting, tests, and build checks as required. Never claim completion when checks fail.
- Before finalizing a coding ticket, perform the cleanup/efficiency review defined in `docs/ENGINEERING_EXECUTION_STANDARD.md`: remove dead/debug code, verify no unnecessary duplication/dependencies/churn were introduced, and review database/network/client work for obvious waste.
- Tests should be deterministic and readable; flaky tests are defects, not acceptable background noise.
- Clearly report every manual action the project owner must perform, explaining required steps plainly because the owner is a beginner programmer.
- For each completed implementation ticket, summarize what changed, tests run, required manual actions, documentation impact, cleanliness/efficiency review, and recommend a Git checkpoint.
