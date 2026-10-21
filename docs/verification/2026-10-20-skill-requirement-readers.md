# Skill requirement reader cleanup — 2026-10-20

Status: **LIVE for testing** at https://aurevane.vercel.app. Production is READY since `2026-10-20T22:34:49.990Z` (18:34:49 Trinidad).

## Result and scope

The shared Resonance reader omits the redundant Automatic sentence and the separate usage limit list across Nexus, battle details and Master previews. All ten ordered characteristics, requirements, effects and effect explanations remain visible. Ordinary Skill and Essence readers retain their activation and limit notes. Master still programs actual native activation and usage limits.

Requirement references use bold tag labels with the existing effect-tag palette and preserve hover/tap help. Full native readers append their existing policy-aware tag explanations at the bottom for Resonances and other Skills. Identical repeated tag explanations are collapsed. None, missing, unregistered and text-mismatched metadata cannot manufacture notes. The footer reuses the same metadata as the existing tag help; it does not parse descriptive prose or look up a replacement historical definition.

This changes presentation only. No engine, cost, cooldown, Barrier expiry, authority, schema, migration or hosted catalogue publication changes occur. Published and captured definitions remain intact. Earlier publication counts belong to their earlier release receipts and were not reasserted through new database writes.

## Source and deployment proof

- PR: [#954](https://github.com/ZeiJM/Aurevane/pull/954).
- Fresh base: `b7ba1e7b3e8b850c53f0d15842c96aecc50ae160`.
- Tested head: `dceef0c6335e6af31bb428b5dc08da458483c9fd`.
- Tested tree: `5200c75d8e2d9d5c92177e2dbd4139f7be194b7e`.
- Merge: `acd82a21b9980c5c99af61301e53f8a20d6c1540`; parents are the fresh base and tested head, and the merge tree equals the tested tree exactly.
- Production deployment: `dpl_3DZxtQMmXYukhKaaD1d1TVC8idGu`, target production, project `prj_ZmH66I1zyOARUt8OXdTl7CN9r18d`, team `team_oZRrN2ckoy5ge7NgZfp1B6de`.
- Deployment metadata pins the exact merge SHA. The canonical alias points to that deployment; verified at `2026-10-20T22:35:24.535Z`.
- Git automatic deployments remain locked. A single explicit production deployment released this change.

## Verification

All six workflows pass on the exact tested head:

| Workflow                        | Run                                                                       | Result  |
| ------------------------------- | ------------------------------------------------------------------------- | ------- |
| Modular ability readers browser | [39496518710](https://github.com/ZeiJM/Aurevane/actions/runs/39496518710) | Success |
| CI                              | [39496518776](https://github.com/ZeiJM/Aurevane/actions/runs/39496518776) | Success |
| Desktop experience              | [39496518705](https://github.com/ZeiJM/Aurevane/actions/runs/39496518705) | Success |
| UI layout review                | [39496518712](https://github.com/ZeiJM/Aurevane/actions/runs/39496518712) | Success |
| Desktop page fit                | [39496518688](https://github.com/ZeiJM/Aurevane/actions/runs/39496518688) | Success |
| Browser smoke                   | [39496518804](https://github.com/ZeiJM/Aurevane/actions/runs/39496518804) | Success |

The complete quality gate passes formatting, lint, all eight package type checks, 11,965 Vitest tests plus seven Node checks, production build, worker boot and the unchanged tracked-source check. Package test counts are game-core 5,360, web 6,325, database 152, validation 106, audio 17, realtime 3 and worker 2. Local focused checks pass 412 reader tests; the final Master assertion correction also passes a 211-test focused run. These overlap and must not be added to the complete suite total.

Browser results are 358 passed/278 project-specific skips for the complete Chromium suite, 73 passed/21 skips for the focused suite, 10 passed/2 skips for Edge, 49 passed/26 skips for desktop experience, 8 passed/7 skips for desktop fit, and 110 passed/61 skips for UI layout. UI setup and movement checks also pass 1 each, with 2 project-specific movement skips. The early Master publication/movement, password recovery and training checks pass 4, 6 and 3 cases respectively. Dedicated simple-requirement checks pass 22 desktop/mobile cases; Primed checks pass 6; the dedicated reader workflow also passes 169 native cohort cases and modular palette/restoration checks.

The original regressions failed on the unwanted Resonance notes, unbolded requirement references and missing paper-palette footer marker before their fixes. All 136 current source Resonances are covered, including their ten fields, effects and unchanged serialized definitions. Two older browser/Master test expectations were corrected specifically for Resonance previews; ordinary Skill/Essence positive limit-note guards and Master programming assertions remain. Independent source and follow-up reviews found no Critical, Important or Minor issues.

The first final-head CI quality attempt hit its 15-minute job budget during build after every unit test had passed. One bounded retry on the unchanged head passes the entire gate, including build and worker boot (job `118890778216`). No workflow or timeout was weakened. The full browser job logs four test-server “destination stream closed early” messages during navigation-heavy Master/roster scenarios; all associated browser assertions and the job pass. These logs are not presented as a clean CI server-log scan. The separate production scan below covers only the initial live deployment window.

Local Chromium installation returned an invalid empty archive; actual CI Chromium and Edge runs supply the browser evidence. Local fixture compilation alone was not counted as a browser pass.

## Browser evidence

All artifacts below belong to the exact tested head:

| Artifact                             | ID          | SHA-256                                                            |
| ------------------------------------ | ----------- | ------------------------------------------------------------------ |
| simple-requirements-browser-evidence | 12298391165 | `2bdd96b93261fe65aca2465e8991b8824e870d9e85de9d4be505a9a4483d0def` |
| primed-modules-browser-evidence      | 12298037177 | `6d983c0a5a401f7bcb04b81b57816ac4485c45f605e7528d467eedaacd2a3cfc` |
| modular-ability-readers-review       | 12297078644 | `541acf5eda25ffaf67c78cbf1cd9d29e3e02a52ffb7a51c5d94ac8648ddcc9b2` |
| basic-service-restore-review         | 12297004391 | `a427ff427d0b02d3507fae066b29e5d7b2c11cba69739ed9a49971a54788897f` |

The simple-requirements and modular-reader archives were downloaded, SHA-256 checked and extracted. Reviewed captures are `resonance-passive-390.png`, `resonance-passive-1366.png`, `modular-nexus-resonance-390.png` and `modular-nexus-resonance-1366.png`. They show bold requirement labels, readable bottom explanations, the correct dark/paper tag colors and no redundant Resonance Automatic/limit notes. Browser assertions also compare footer/effect label colors and preserve generic Skill notes.

Fixtures intentionally include synthetic multi-group definitions for compatibility coverage. Their displayed loadouts are not representations of the live Resonance catalogue. Evidence is viewport/browser testing, not physical-device or human gameplay acceptance.

## Production checks

The canonical deployment/source match and all seven requests pass, checked at `2026-10-20T22:35:43.069Z`:

| Route                               | HTTP |
| ----------------------------------- | ---- |
| `/`                                 | 200  |
| `/manual`                           | 200  |
| `/manual/techniques-damage-effects` | 200  |
| `/rules`                            | 200  |
| `/api/foundation/auth-status`       | 200  |
| `/game/world`                       | 200  |
| `/game/character`                   | 200  |

World and Character responses are account-entry gateways; these checks do not claim signed-in hosted gameplay. The deployment-scoped warning/error/fatal scan from `2026-10-20T22:34:49.990Z` through `2026-10-20T22:35:52.081Z` returns no matching entries. This is an initial bounded scan, not a load or long-running stability claim.

## Owner testing and continuation

Refresh the page to load the new reader. A new battle is not required for this display-only update. Check Steamfront, Banked Furnace and an ordinary Skill with a tag requirement on phone and desktop: the requirement tag should be bold, its explanation should appear at the bottom, and Resonance should omit the Automatic/usage list while retaining its effects.

Human signed-in and physical-device testing, multiplayer/load acceptance, broader Master Task8 and World movement acceptance remain open. No phase closure is claimed. The companion JSON receipt contains machine-readable source, workflow, artifact and deployment metadata without temporary signed URLs or credentials.
