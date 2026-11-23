# Actual browser zoom method preflight — 2026-10-23

This is environment/method preparation for Task13, not Aurevane browser acceptance.

Official primary references checked:
- https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom
- https://developer.chrome.com/docs/extensions/reference/api/tabs#type-ZoomSettingsMode
- https://playwright.dev/docs/chrome-extensions

Chrome's tabs.setZoom changes the tab's browser zoom; use automatic mode (the browser performs scaling), not manual mode (the extension must scale content). tabs.getZoom reads the factor. Playwright documents persistent-context bundled Chromium with the chromium channel for extension-capable headless operation; current branded Chrome/Edge removed extension side-load flags. Do not treat deviceScaleFactor, CSS zoom/transform, or visualViewport page scale as actual browser zoom.

One disposable external environment proof attempted runtime Playwright1.62.1 with installed Chromium1194, persistent disposable profile, localhost-only extension, fixed1366×768 viewport, automatic/per-tab zoom2 and expected readback plus width1366→683/DPR1→2. It failed before any page/extension/zoom operation: Chromium process_singleton_posix.cc292 socket() failed Operation not permitted, followed by process abort/ptrace diagnostics. Source/app files were not used or modified. No elevated retry or assertion relaxation was attempted. Full raw transcript is browser-zoom-environment-proof.log.gz, deterministic gzip1626bytes/SHA25641faa01d701c29cfe44eacf760359de99708195148f300246972a647f671e2d5. The local proof script is transient preparation, not product implementation or a passing check.

Task13 should exercise a reviewed actual-browser zoom fixture on the native runner that can launch Chromium. Record tabs.getZoom=2, automatic mode, viewport/layout metrics and representative screenshots, then real keyboard/touch/visible controls. Confirm actual app flows at the changed effective width. Prefer a localhost-only disposable extension/profile, no account profile or broad host access. Since navigation resets per-tab zoom settings, set/read actual zoom after navigation as needed. A passing static environment probe alone would still not establish app acceptance.
