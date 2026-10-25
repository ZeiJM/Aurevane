# Mobile log space and battle artwork

Owner follow-up to the live PR #978: mobile's full log starts with its recorded round heading, without the dark desktop Chronicle header behind the parchment. Opening it hides the picture timeline and uses that space for the reader, with one small gold round toggle at the bottom to return. Keep the preview, battlefield, footer dimensions, mounted history, explicit expansion and scroll state, and combat authority. Apply the same composition to PvE/PvP/spectators; desktop Chronicle stays unchanged.

Use the existing mobile log workspace and timeline toggle rather than mounting another log or introducing a modal. Extend its reader over the reserved timeline row, hide the redundant mobile heading/track, and retain the toggle above the parchment. The first visible content is a recorded round, not a duplicate Battle Chronicle title; existing live-follow/history behaviour is preserved.

Replace the remaining basic Chronicle placeholder drawings with generated dark fantasy raster artwork for Defenseless, MP recovery and generic battle events. Keep recorded identity, existing skill artwork and unknown-event honesty. Save optimized versioned WebP assets and generation prompts; no catalogue publication.

Additional Owner steering: desktop chat remains draggable, but its drag header must stay fully visible below both site/battle headers. Clamp movement against their measured visible bounds and the viewport; refit on opening/resizing without remounting chat or losing a draft. Keep mobile chat and its single-row footer unchanged.

Verify real production components at320/390portrait,844coarse landscape and desktop, including spectator parity, history/toggle/rotation, no combat requests, asset decoding and drag/re-drag after edge moves and resize. No previews. Publish for configured CI; one final production only after all exact-source gates and exact tested-tree merge verification.

Additional Owner steering: hide the redundant full-capacity Techniques note on mobile (including Discipline2), retaining its capacity counter, disabled Equip, selection limits and other error/eligibility messages. Desktop keeps its existing explanatory note.

Latest Owner steering: slightly reduce mobile traditional-log typography. Use13px narration,12.5px outcome/round text,14px actor and13.5px action headings with1.4body line height. Scope to the full mobile workspace; desktop and separate completed reports retain their type sizes.
