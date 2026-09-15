# AUREVANE Sitewide Layout v2 Design

**Date:** 2026-09-15
**Branch:** `agent/sitewide-layout-v2`
**Authority:** existing approved 29-screen dark-fantasy concept suite, current game source, and the Owner's instruction to make the layout visibly different in production.

## Goal

Create an unmistakable structural layout change across AUREVANE without changing routes, mechanics, server authority, combat rules, progression, privacy boundaries, or invented systems.

## Why this pass is different

The approved all-pages concept overhaul is already present on current `main`. The recent HQ character-creation refinement therefore produced little visible change outside character creation. This pass targets the remaining high-leverage structure: shell geometry, viewport use, navigation density, and cross-surface framing.

## Visual contract

Preserve the approved AUREVANE language:

- ink-navy framing;
- moonstone information surfaces;
- charcoal reading text;
- literary serif display type;
- fine aged-gold rules;
- restrained teal interaction states;
- violet magical accents;
- scenery-first environmental backdrops;
- character/unit art only in identity slots;
- square character/skill identity art where applicable.

The layout may borrow compact structural ideas from the earlier Veilbound study, but it must remain visibly AUREVANE and must not copy branding, text, assets, or proprietary art.

## Structural design

### Authenticated desktop shell

Use the desktop viewport as a compact game frame:

1. A slim global masthead contains AUREVANE branding, News/Manual/Rules, and Account utilities.
2. A narrow icon-first game rail owns the three permanent destinations: Profile, Battle Hall, Passive Training.
3. A dedicated context strip sits above the current workspace and shows the current screen plus selected-character identity. Active-battle/spectating return state stays visible here.
4. The workspace gets the majority of horizontal and vertical space.
5. Online Users remains a shell-level destination in a compact status/footer bar.
6. Battlefield layouts keep their existing tactical geometry and controls; the shell change must not resize the authoritative board incorrectly.

Desktop target: at 100% zoom, ordinary hubs should fit within the viewport where practical. Dense/long content uses bounded internal scrolling instead of forcing the entire document to become a long page.

### Authenticated mobile shell

Keep the same information hierarchy while avoiding a tall chrome stack. Primary game navigation remains touch-sized and accessible, while the masthead and context information become more compact than the current mobile presentation.

### Public/account/roster surfaces

Use the same masthead proportions, borders, spacing rhythm, and framed-canvas treatment so login, character select, News, Manual, and Rules feel like one product. Do not invent a dashboard, world map, shop, guild, inventory, quest, or social hub.

## Page interiors

Do not redesign gameplay flows that already match the approved concepts. Instead:

- allow Profile's existing three-column desktop composition to use the newly reclaimed viewport;
- keep Battle Hall's AI/PvP/Spectate workspaces and PvP lobby modal intact;
- keep Passive Training state transitions intact while using a denser framed workspace;
- keep Online Users filters/public profile behavior intact;
- preserve Character Creation `01 Identity -> 02 Discipline -> 03 Confirm`, 40 starter portraits, and hidden pronoun compatibility behavior.

## Accessibility

- Navigation labels remain available to assistive technology even when desktop labels are visually collapsed.
- Existing `aria-current`, disabled active-session navigation, skip links, and account controls remain intact.
- Touch targets remain at least the project's existing sizes on mobile.
- Reduced-motion behavior remains respected.

## Verification

A release is acceptable only when:

- focused shell/navigation regression tests pass;
- full repository CI passes formatting, lint, typecheck, tests, build, worker boot, and database foundation checks;
- final branch comparison shows no unrelated gameplay/server changes;
- current `main` freshness is rechecked immediately before integration;
- Production is only changed after the verified result is merged/fast-forwarded and the repository's Vercel deployment lock procedure is followed;
- the live production domain returns successfully after release.
