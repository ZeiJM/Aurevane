# UI Shell and Passive Training Cleanup Spec

## Goal
Standardize the authenticated desktop shell and simplify Passive Training to match the approved screenshots without changing game mechanics.

## Approved requirements
- Standardize the authenticated footer size across pages.
- Remove the footer Navigation button; keep Online Users as the social-directory entry point.
- Remove Adventurers from the primary game rail while preserving `/game/online`.
- Make the desktop selected-character portrait square (1:1).
- Remove the shared authenticated header back-arrow wherever it appears.
- On Passive Training, keep the `Passive Training` hero title but remove `Background progression`, the descriptive hero paragraph, and the Simple rule box.
- On the training plan card, keep `Choose a training duration.` but remove the `Training Plan` kicker and the idle introductory paragraph.
- Center the Rate and Complete label/value content inside their reward boxes.
- Reclaim vertical space naturally after content removal. Do not use transform scaling or hide/clamp content merely to suppress scrolling. Only make additional spacing adjustments if the cleaned layout still produces unnecessary desktop page scrolling.
- Preserve all server-authoritative training, XP, timing, battle restriction, online-directory, and routing behavior.
- Deploy the verified result to Vercel Production for testing.

## Out of scope
- No training formula changes.
- No Battle Hall mechanics changes.
- No online-users route removal.
- No production data changes.
- No broad visual redesign.
