# Battle map and repeated-input fit — 2026-10-01

## Scope and authority

Owner-requested continuation of the approved UI maintenance release. Starting main: `a177bbb3ae6593a4761379d941706f86d909a99d`; branch: `agent/battle-map-cockpit-fit-20261001`. Existing Owner merge/deploy authorization applies. No migration, reward, combat-content activation or gameplay authority change is included.

## Result

- Forecast track is fixed at 44px instead of 68px; its heading sits beside the parameter/outcome lanes. AI/PvP share it; spectator geometry follows it. Phone flow remains natural.
- Cockpit artwork, names and info/hotkeys share consistent tracks. Empty slots and End Turn align; facing buttons use a reserved lower row. Visible supernatural Coming soon is removed; its information remains available. Narrow desktop names fit two lines while full accessible labels/info remain intact.
- Both rail cards have the same allocation. Square portraits span the name-to-facing width when their row permits and adapt to short screens. HP/MP stay inline and two ten-icon effect rows remain reserved.
- Terrain samples are 28px on regular desktops and 24px on narrow desktops, with the full six current terrain kinds checked.
- Basic Attack/enemy range uses shaded red frames. Move highlights and clicks accept only legal adjacent steps, without path numbers; Movement allowance and terrain AP charges remain authoritative.
- Move/actions stay selected after same-turn commits. Action forecasts rearm informationally at the accepted version. A second hotkey casts a self target, including unit effects aimed at the local actor. WASD retains an eligible identified target in the requested direction. Held-repeat keys and pending operations cannot queue duplicate commits.
- Cancel, rejected requests, terminal state, turn handoff and a new local turn clear planning. Current Manual instructions match these controls.

## Local verification

- Separate repository formatting, lint, TypeScript, complete tests and Production build commands passed: 3,098 Vitest tests and seven Node checks. Package and affected E2E ESLint checks also passed. The initial local build dependency reuse was rejected by Turbopack because of external worktree symlinks; copying dependencies and correcting workspace links resolved the environment issue before the successful build. No package or lockfile change was needed.
- Actual shared-component fixture: 48 layout cases, AI/PvP/spectator × ordinary/dense × eight viewport sizes (1917×987, 1366×768, 1536×614, 1024×768, 1024×576, 900×576, 821×768, 390×844). Dense cases include twenty effects, all six terrain kinds and populated Timeline/Text logs with each actor filter. Final facing and forecast chips remain contained; desktop document/card overflow guards pass.
- Long authored names were included at 821px/900px/1024px desktop widths. Independent review reproduced an overlap before the bounded label fix and verified the final bounds. Full accessible names remain available.
- Before/after map comparison at height-limited desktop sizes gained approximately 22–30px; a width-limited 1024×768 board was unchanged. Action targeting and facing retain stable board geometry.
- Actual controller fixtures cover repeated unit/ground WASD, self/recovery hotkeys, unit self/ally targets, adjacent Move, exhausted AP, pending locks, key repeat, typing/dialog guards, delayed cancellation, illegal preview, stale-version refresh, rejected commits, remote new local turn, handoff and terminal state.
- Independent review found a rapid-rearm stale-version race, reproduced with authoritative stale-preview rejection. Version receipt gating resolved it: implementer 12/12 and independent reviewer 20/20 rapid-input runs passed. No unauthorized commit was observed before or after the fix.
- Durable E2E guards were added for repeated self casts, immediate-step movement, pending commit inputs, rapid version rearm, aligned controls/name bounds, equal cards, terrain sample sizes and the 44px stable forecast. Authenticated server-backed execution belongs to disposable CI, not Production account mutation.

## Candidate, CI and release

Initial candidate `220ca88190e0f93494a05870fb60aeebafa326e4`: CI and authenticated UI layout review passed. Representative Buildcraft failed an obsolete post-cast deselection assertion; the early Browser smoke suite failed the equivalent post-Move assertion on desktop and mobile. New repeated-input, immediate-step, pending-input and rapid-rearm scenarios passed in that run. The follow-up changes only E2E expectations and this evidence: retained selection replaces automatic deselection, Guided Fundamentals traverses two individually accepted adjacent steps instead of one full path, and its Guard proof uses AP/selection/criteria rather than a transient commit notice. Damage/AP, server commit, reload persistence, turn handoff and terminal checks remain intact.

Follow-up `fdb52729d406ea122c5db4b962f34c261ec8ff83`: CI and Representative Buildcraft passed. Browser smoke exposed name-dependent portrait geometry at 1440×900: a wrapped ScaleHost name reduced the portrait from 178.8px to 167.3px while the card stayed equal. Actual-component reproduction matched those values. The desktop identity now uses one line with ellipsis/full hover title and a bounded grid column; phone wrapping is preserved. The same reproduction passes with zero portrait drift at 1440×900, 1366×768, 900×768 and 821×768. Forecast layout checks now require equal portrait height as well as equal card height. Independent review also caught Guided Fundamentals' obsolete illegal-Move notice, updated to the adjacent-step wording.

Pending exact-head CI, application merge, configuration-only Production release, bounded live smoke/runtime checks and relock. Deployment configuration remains fully disabled during development.

Independent review: no remaining P0/P1/P2 blocker after the two reproduced findings were resolved. Local fixtures are controlled receipts and are not represented as independent human playtesting or Production gameplay acceptance.
