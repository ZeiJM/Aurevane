# Owner follow-ups for the remaining overhaul

These October 12/13 requests extend the approved overhaul. They are pending
implementation and are not bundled into the accepted-foundation release.

## Miss-dependent secondary healing

A Skill that misses must not trigger its secondary healing effect. Trace the
actual hit/packet/recipient relationship before fixing it; preserve independently
authored native mechanics such as Fire caster cleanse. Add actual miss/hit and
area-recipient regressions rather than changing narration alone.

## Account portrait placement

Remove the mini character portrait immediately left of the Account button in
the shared header. Put it inside the Account dropdown, on the same top row as
"Welcome back, [player]", aligned to the far-right corner with a small inset.
The October 13 repeated request confirms the same scope, not a second portrait
or a separate redesign. Cover desktop/mobile and shared-header placements.

## World Environment / weather Master workspace

Include the newly added World Environment workspace in the professional Master
overhaul, aligned with the actual world systems and the shared shell.

- Remove Recent Changes and its administrative change-tracking workflow.
- Remove required written change reasons and reason logging throughout the
  Master Panel. Remove policy/version-number tracking from its user experience.
  This replaces earlier requirements to retain those administrative displays;
  immutable gameplay captures and concurrency identities are distinct engine
  correctness mechanisms, not user-managed policy-number controls.
- Weather labels must accurately correspond to rendered regional weather,
  including rain versus snow. Do not call biome-dependent snow "rain" without
  making the regional result explicit.
- Support a manually entered forced-weather duration in minutes, rather than
  only preset durations. Expiry returns to the actual ordinary weather authority.
- Add configurable day/night cycles and pertinent controls; the real map must
  transition through day/night, and the travel screen's right panel must show
  current world time/phase/weather clearly and compactly.

## Map loading while moving

Owner reports that world-map areas take a while to load and can remain
incompletely rendered while travelling (October 13, 22:47 Trinidad time).
Investigate asset readiness, visible-area loading and renderer updates during
continuous movement. Cover repeated travel and region transitions, including
slower connections. Preserve current movement responsiveness and map visuals.
The accompanying image was unavailable at its supplied scratch path; this
requirement is recorded from the Owner's description, without claiming a
visual diagnosis.

Earlier screenshots were inspected directly. These additions remain part of the
full batch after the foundation release; no weather, audit, roster or Account
UI implementation is claimed by this document.
