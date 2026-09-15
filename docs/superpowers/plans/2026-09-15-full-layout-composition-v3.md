# AUREVANE Full Layout Composition v3

**Goal:** Replace the major player-facing page compositions that still visually read like the legacy stacked-card UI. This is a markup + component-module CSS pass, not another global CSS overlay.

## Root cause being fixed

The previous `sitewide-layout-v2` release changed shell geometry but left most major page compositions intact. Its strongest page rules were also desktop-only (`min-width: 981px`), while <=980px explicitly fell back to existing responsive composition. Production therefore legitimately continued to look almost unchanged on narrow/mobile screens and still familiar on desktop.

## Visual authority

Use the existing approved AUREVANE concept direction and assets:

- ink-navy framing;
- moonstone/parchment information sheets;
- charcoal text on reading surfaces;
- literary serif display type;
- aged-gold rules;
- restrained teal interactions;
- violet magic accents;
- scenery-first environmental art;
- square character/skill identity art where appropriate.

Preserve all current routes, mechanics, server authority, privacy boundaries, combat behavior, training behavior, character progression, and account state.

## Structural targets

### Shared authenticated frame

Desktop keeps the slim rail + compact masthead + context strip. Narrow/mobile gains a true bottom primary navigation dock for the same three real destinations: Profile, Battle Hall, Passive Training. Do not invent additional destinations.

### Character Profile

Replace the giant portrait-first mobile stack and old three-tall-column feel with a dossier composition:

- compact identity banner containing square portrait, name, build tags, level/XP, HP/MP;
- moonstone character sheet as the principal reading surface;
- separate dark Combat Loadout panel;
- desktop may use two primary columns beneath the identity banner;
- mobile keeps identity compact, then sheet, then loadout.

### Battle Hall

Replace the horizontal-tab + generic stack with:

- desktop left mode rail for AI / PvP / Spectate;
- main active workspace with scenery and real controls;
- mobile compact three-mode strip, scenery shown early, then the active controls;
- preserve lobby modal and every existing launch/join/spectate handler.

### Passive Training

Replace top-hero + stacked planner with:

- desktop split composition: scenic cloister/state panel + moonstone planner/report workspace;
- mobile compact scenic banner + moonstone planner sheet;
- preserve idle/active/completed behavior and rewards.

### Online Users

Replace generic dark directory stacking with:

- desktop dark control/filter rail + moonstone roster sheet;
- mobile compact controls + readable roster sheet;
- preserve online/all modes, filters, sorting, public profile behavior, and privacy omissions.

### Character Select

Replace the tall generic slot-card stack with:

- desktop framed roster stage using scenery and a denser slot board;
- mobile compact roster header and square identity cards;
- preserve select/create/delete/account-delete behavior and true slot identity.

## Verification contract

1. Write failing structure tests first that require semantic composition markers on the actual major page components and require mobile-specific layout rules in their own component modules.
2. Prove RED in CI before production edits.
3. Implement component markup + component-module CSS.
4. Remove v2 page-specific override authority where it conflicts; keep only genuinely shared shell behavior.
5. Run full repository Quality + Database CI on exact final head.
6. Compare with fresh `main`, ensure no server/game-rule changes.
7. Production release only from verified exact head using the one-shot Vercel lock procedure.
8. Verify the live bundle includes v3 component rules and canonical Production is READY before reporting completion.
