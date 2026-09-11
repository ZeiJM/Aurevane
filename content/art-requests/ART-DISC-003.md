# ART-DISC-003 — Advanced roster media

Status: LIVE FOR OWNER TESTING through PR #454 and release `4ec4036c`. Ten painted advanced Discipline identities/Essence images supplement the semantic regular Skill icons. Independent human art acceptance is pending.

Scope: Bastion, Ravager, Edgedancer, Wildwarden, Runeblade, Dawnshield, Cinderweaver, Frostweaver, Stormsinger and Tidecaller. Each has eight Skills and one Essence; 105 added Resonance pairs share their two Discipline motifs.

Current source: `apps/web/src/components/battle/phase4-combat-art.ts`. Original repository-authored SVG paths combine Discipline silhouette, target shape and effect glyph; no external samples, generator or license dependency. Stable gameplay media IDs remain replacement hooks. Existing approved Foundation illustrations are preserved.

Visual direction: mature tactical fantasy, clear material silhouettes at 64px, controlled class palette. Shield/axe/blade/bow/rune/sun/flame/ice/lightning/water are distinct identity families. Avoid excessive bloom, embedded typography in eventual painted masters and copied franchise imagery. Reckless and Fortified must communicate both risk and benefit.

VFX requirements: local, brief confirmed-impact accents; Root/Slow visible in status inspection; area/line previews must remain legible. No full-screen flashing or animation that delays commands. Existing target overlays and committed HP/status/log feedback provide the current playable representation in PvE and PvP.

Budget: code-native icons add no network media requests; share ten identity families and effect/shape primitives. Future raster runtime icons should target at most 40 KB each with lazy loading. VFX at most 500 ms, no persistent particle loops, reduced-motion alternative and no authority changes.

Delivered: illustrated source candidates with provenance, 64/128/256px WebP derivatives, registered 128px identities and 256px Essence presentation. Independent human Art Bible review remains required; automated content coverage does not substitute for it.

Set 01: ten generated identity illustrations with retained prompt/hash provenance and 64/128/256 px review encodes. These supplement the semantic Skill glyphs; 80 bespoke Skill paintings are not claimed. Review through the standalone media packet. The Owner subsequently authorized continuation and live evaluation. Runtime files are now integrated with exact hashes in `content/media-releases/phase4-v01.json`; original candidate manifests remain unchanged. All six release workflows passed, with artwork loading checked across three browser viewports and in production. See `docs/PHASE_4_TICKETS.md` for release evidence.
