# Training and Battle Hall live-review refinement — 2026-10-01

The Owner requested removal of the Training “Same steps. A farther horizon.” copy, a restored compact Spectate entry at 100% desktop zoom, and shortening AI Battles’ empty parchment.

## Diagnosis and change

Fresh base: `1c591bb0fb2872bdc17594c90a0f128b15e00c77`. The Training request identifies the decorative right-hand header copy; the useful Passive Training heading, cloister background, plans, active session and inline reports remain. Its unused styles are removed.

The final Hall composition bottom-aligned Spectate’s workspace, leaving 123–273px between its tabs and panel at representative desktop sizes. Its previous fit change also placed the access-note emblem on the far left. AI’s forced full-height workspace reserved 130–314px after the last control. A local render of the actual components and production CSS reproduced these geometry failures before the fix.

Spectate is now placed immediately below the tabs, its emblem and note are centered again, and its banner, padding and gaps are reduced. AI uses intrinsic content height. Short desktop Hall headings and tabs are compact, with narrow short-window AI options preserving readable text. Phone layout retains its natural flow. Launch modes, values, callbacks, private access and authoritative game state are untouched.

The existing authenticated Hall regression now guards adjacency, centered Spectate emblem and at most 24px unused AI parchment in addition to its existing overflow, readability, usable-target and control-containment checks. AI and Spectate also exercise 1024×768 and 1024×576. Existing Training idle/active/report/claim coverage remains.

## Verification

A temporary local synthetic render checks AI and Spectate at 1728×885, 1440×900, 1366×768, 1536×614, 1280×720, 1024×768, 1024×576 and 390×844. All seven desktop sizes show no document/main/panel/body overflow, all controls at least 44px and contained, no tab-to-panel gap, centered Spectate note, and AI parchment ending within 24px of its controls. This checks presentation with fixture identity, not authenticated persistence. Exact-candidate CI, final quality gate, review and release details are pending.
