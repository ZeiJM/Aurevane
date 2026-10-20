# Skill requirement reader cleanup — 2026-10-20

Status: implementation verification in progress; not yet live.

Owner screenshots show Steamfront and Banked Furnace with a redundant Automatic sentence and separate Once per round / Once per action bullets. Resonance readers now suppress those annotations through the shared definition reader. The ten ordered fields, effects and effect explanations remain visible. Generic Skill readers retain their activation/limit notes, and Master still programs the original native activation presets and usage limits.

Requirement tags are bold and use the effect-tag color while retaining their existing hover/tap help. Native full readers append matching requirement-tag explanations at the bottom, for Resonances and other Skills. Explanations reuse the existing policy-aware reference metadata; duplicate identical notes are collapsed. None and absent, unregistered or text-mismatched metadata cannot invent notes. Saved and historical definitions are not rewritten.

Scope is shared presentation only. No catalogue publication, migration, mechanic, cost, cooldown, expiry or authority change is required. The prior release receipt records current294/history953/drafts0/policy8; this display change does not mutate the catalogue. Broader Master Task8 and World movement acceptance remain open.

Verification: the original all-current Resonance regression failed on the Automatic/limit notes before the fix; the added requirement test failed on the unbolded tag before its fix. The focused shared-reader checks pass412 tests, including all136 current Resonances, ordinary Skills and stale metadata. Web type checking and scoped web ESLint pass. The production browser fixture compiles180 actual modules. Local Chromium installation returns an invalid empty archive, so compilation is not a browser pass; actual desktop/mobile checks and full exact-head CI remain required before release.

The existing simple-requirements browser regression now checks bold requirement tags and bottom explanations across Nexus, battle and Resonance readers. It verifies that Master saves activation/limits, generic readers retain their notes and Resonance omits the redundant notes while preserving effect explanations. Desktop/mobile Resonance evidence captures are included. Git auto deployments stay locked.

First exact-head browser CI reached the real modular Resonance reader and exposed an older assertion requiring its Once per battle note. The expectation now distinguishes Resonance inline/popup readers (note absent) from generic Skill readers (note retained). All other fields, ongoing semantics, effect colors, native limits and source definitions remain unchanged. This is a browser assertion correction, with a fresh exact-head run required.
