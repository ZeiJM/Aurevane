# Battle workspaces and reliable activity

Owner scope: October 24 follow-up to PR #977. Preserve the cleaner approved UI and combat authority.

## Battle presentation

- Mobile footer is exactly one row at its existing single-row height. Chat, copyable battle key, spectator count, Terrain, Cancel and Surrender share the row with compact labels, accessible full names and visible gaps. Preserve conditional confirmation controls without clipping; do not allocate another footer row.
- The gold Current / Round badge toggles the traditional full battle log in the cockpit space. Add a small recirculation icon without enlarging the badge. Retain the horizontal action timeline.
- Mobile Chat toggles real shared battle messages, never the log. It occupies the preview and cockpit space, with no close X. Terrain, log, chat and action details are mutually exclusive. Returning to actions preserves the battlefield and command guards. Desktop chat retains its existing window.
- Show a restrained green Your turn / red Waiting for <name> cue in the existing preview, alongside text. Do not animate geometry or flash. Terminal and spectator states must remain accurate.
- Centre mobile cooldown number overlays in the existing skill artwork.
- Test Essence and Resonance recorded outcomes through the shared Chronicle renderer. Repair only a demonstrated omission or inconsistent presentation; preserve privacy, recorded values and historical captures.

## Independent investigations

World zoom: reproduce the slight desktop/mobile jitter before changing camera, zoom feedback or rendering. Keep movement, zoom lock and canonical authority intact. PR #933 stays separate and unresolved.

Online directory: the Owner accepts heartbeat-based Last Seen. Actual character selection and authenticated training activity must not leave a playing character with no recorded activity. Keep online liveness distinct from offline progression. Never invent historical login dates; unknown historical activity must be labelled honestly. Check the complete roster against the gateway row limit.

## Approach

Use the current shared battle cockpit and real chat transport, rather than a new overlay or separate mobile implementation. Use one per-battle workspace state shared with the chat bridge. World and activity repairs remain independent, small and testable. The generated image is a rough concept only: its extra footer height and missing timeline are explicitly not implementation requirements.

## Release and verification

Use focused regressions during implementation, then one final quality/build/browser gate on the integrated tree. Verify PvE/PvP, participants/spectators, 320px portrait, ordinary phones, coarse landscape and desktop. No preview, hosted data/schema changes or production deployment during implementation. Final publication must preserve the git deployment lock and report remaining human acceptance honestly.
