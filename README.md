# AUREVANE

AUREVANE is an original persistent browser-based tactical fantasy RPG.

## Project authority

Development is governed by the documents in `docs/`, with the following precedence:

1. `docs/GAME_MASTER_PLAN.md` — authoritative game design, architecture, and implementation order.
2. `docs/ART_BIBLE.md` — authoritative visual identity and asset standards.
3. `docs/AUDIO_BIBLE.md` — authoritative music, SFX, ambience, and audio-runtime standards.
4. `docs/MEDIA_PIPELINE.md` — authoritative production workflow for game media.
5. `AGENTS.md` — non-negotiable development rules.

The full master plan describes the final game. It is **not** permission to implement all systems at once. Work proceeds in the documented phase/sprint order and one implementation ticket at a time.

## Development principles

- Server-authoritative persistent gameplay.
- Deterministic, testable game systems.
- Data-driven content.
- Art and audio are first-class product requirements from the beginning.
- Responsive, polished browser presentation rather than a CRUD-style game UI.
- No unlicensed third-party assets or copied proprietary game content.
- Every ticket is verified with relevant tests, type checking, and linting before completion.

## Repository shape

```text
apps/
  web/          # Next.js browser application
packages/       # shared/domain packages introduced only when their ticket begins
content/        # art/audio requests, seed content, balance data
docs/           # authoritative design and engineering documents
```

The complete target monorepo shape is defined by the Master Game Plan. Empty future packages are not created prematurely.

## Local development

Prerequisites:

- Node.js 24 LTS
- Corepack
- Git

From the repository root:

```bash
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Before proposing a merge:

```bash
pnpm check
```

That command runs formatting verification, linting, TypeScript checks, unit tests, and the production build.

## Vercel

The repository is a monorepo. Configure the existing Vercel project with **Root Directory** set to:

```text
apps/web
```

Vercel should use the Next.js framework preset. Keep secrets in Vercel environment settings, never in Git. Preview deployments are used for development review; `main` remains the production branch.

## Current state

Phase 0 is active. The discarded prototype has not been imported. See `TASKS.md` for the one currently allowed implementation ticket.
