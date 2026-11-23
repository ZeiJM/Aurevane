# Resonance preview sizing — October 27, 2026

Owner request: selecting a Resonance must use the ordinary Skill preview size without shrinking the map, including applicable mobile behavior.

The shared `BattleExperience` renders inspected passive captions as a paragraph directly inside the preview strip. Unlike the active `BattleActionPreview`, that paragraph had no local margin reset or forecast typography. Its default paragraph margins and inherited type enlarge the content-sized desktop preview row. The board receives the remaining space and consequently shrinks. Mobile already reserves a fixed preview height; the same caption reset removes excess internal spacing there.

The fix sets only this direct caption's margin and font to match the ordinary forecast. PvE and PvP consume the same stylesheet. Existing mobile font overrides, full information readers, artwork and combat authority remain intact. Spectators cannot select Resonances and need no separate change.

Verification selection: formatting and JavaScript syntax; adjacent preview/command component tests; the existing command-feedback browser guard with new assertions comparing preview, battlefield and fitted-board rectangles against active Skill selection. Its existing matrix covers PvE/PvP desktop, narrow phone, standard phone and touch landscape. Broader server/database tests are outside this display-only delta. Configured PR checks remain required, including Browser Smoke/core coverage.

Local adjacent preview/presentation tests: 60 passed. Formatting, JavaScript syntax and patch whitespace checks pass. Browser execution could not start because Chromium is absent; its download returned invalid/truncated archives in this environment. Rendered geometry and native CI acceptance therefore remain pending; no browser pass or visual acceptance is claimed. Initial unit invocation from repository root missed the web alias config; rerunning from `apps/web` passed. ESLint intentionally ignores the existing browser script; syntax and formatting are checked directly.

Initial base: `68fdfd654885466f09cce5ca4c4e571308c43858`; refreshed base: `10f2ea07202e8b4e4866a1ea41c06cedc2152e97`. The intervening Archive activity change does not overlap these production/test files and is preserved. Task branch: `agent/resonance-preview-size-20261027`. Automatic Git deployments remain disabled. The Owner authorized publication and production release after checks pass on October 27: “Yes make live when ready.” Release remains pending until that gate passes.
