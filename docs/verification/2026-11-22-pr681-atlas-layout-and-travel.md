# PR 681 Atlas layout and travel verification

The current Atlas compositor and the eight V02 settlement headers use the same authored terrain and scenery. Regional settlement and watch landmarks retain their current coordinates. Source and Chromium renders cover all eight towns, the two Asterwake terminal approaches, Gildroot Grove, the globe, and Verdant Expanse at minimum zoom on a phone-sized viewport.

The public atlas begins numbering in the established Isola heartland. Outlying charted land and Asterwake follow in geographic order, with the Void numbered from 8193. The Master Panel rejects older numbering contracts. Stable saved sector IDs and local coordinates remain the navigation and persistence authority. The chart resolves labels from public addresses alone and defers generating terrain and roads until a caller needs them. The eight V02 headers use 385,350 bytes in total, down from 5,473,708 bytes for the V01 headers.

Asterwake’s outbound ferry boards from the North Shore terminal before minute 15. The return ferry boards from Asterwake before minute 45. Both board for the final five minutes and travel for five minutes. The original Uncharted service retains its existing routes and time slots.

Verification covers these changes:

- Regional landmark identity, historic routes and open approaches, visible blocked water and lava, and recovery from newly impassable saved cells.
- Varied mainland canopy selection, stronger weather-driven movement, bridge bank alignment, dry ground while charted terrain hydrates, and held-key cadence.
- Both new ferry legs against the actual database migrations, including repeated boarding receipts, and v6 Master Panel teleport authority with blocked destination checks.
- The world and Master Panel travel controls, public picking, and the World scene payload bounds.

The current candidate is for visual review. A signed-in hosted browser run and Owner visual acceptance are release gates. Production rollout requires the two reviewed database migrations and a separately authorized deployment.
