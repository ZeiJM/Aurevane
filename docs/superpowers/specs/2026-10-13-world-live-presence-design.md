# World live presence and presentation follow-up

Owner scope: October 13 reports delayed peer movement, a pause after three locally previewed steps, blurred portraits, Verdant bridge contact, Emberreach water, possible Frostmere rock contact, and asks for the current dark crystal cursor throughout the site.

## Delivery contract

Keep travel commands, persisted positions, encounter range, collision, discovery, minimum authored step durations and the 600 ms unconfirmed preview unchanged. Remove unnecessary presentation work before a command commits. Render identities on a separate native-density canvas while keeping scenery's existing density/cache bounds. Use one canonical cursor asset globally, retaining text-entry, disabled, resize and drag semantics.

Peer updates must arrive through authenticated Supabase private Broadcast. Broadcast contains only an empty scene invalidation, never a character ID, position, route or private cell. A service-only registration records at most 25 server-projected scene IDs for an owned character, expiring after two minutes. A narrowly granted receive-policy helper checks the current authenticated owner, registration expiry and deletion status. Browsers cannot publish or widen registrations. A database trigger emits once to each distinct old/new scene topic after a changed authoritative World state; heartbeat-only reads emit nothing. Shared scene topics avoid per-observer database sends.

The browser coalesces invalidations into an independent, abortable presence read. It must not queue behind travel commands, change the owner's movement clock, or overwrite a different character/version/scene. The authenticated endpoint derives the selected character and reads only the server-registered scene. It returns current public peer identities and a bounded prefix of approved movement with the database receipt clock. Normal polling remains the fallback during disconnect, before registration, or before the additive migration is installed.

Only known, supplied, walkable consecutive route steps may enter a peer movement receipt. Stop at the first withheld/private/unknown step; never disclose the rest, destinations or private state. Keep persisted `position` and `attackable` semantics independent of animation. Peer motion follows the server clock rather than replaying a several-second-old trail. Reject stale versions and stop/replacement receipts; dispose subscriptions and pending reads on unmount/character replacement.

The new service-only reader/registration, private Broadcast receive policy and state trigger are an additive database migration. Preparing and testing this source is authorized by the requested fix; applying it to the hosted database still requires the Owner's explicit migration approval. This work does not authorize a new Vercel deployment.

## Verification

Focused deferred tests prove commands reach commit before scene/environment enrichment. Peer projection tests cover hidden route tails, invalid bounds and preserved attackability. Motion tests cover delayed clock receipts, repeated/stale versions, stop/replacement, seams, missing terrain and suspended sources. Subscription tests cover coalescing, disposal, independent reads, version/scene guards and polling fallback. Disposable database and two-player browser tests prove private-channel receive authorization, denied client publishing/widening, immediate committed-movement notification and absence of private payloads. Retain the strengthened 100 decoded portrait benchmark and all prior responsive/Atlas checks. Native browser/database execution unavailable locally must be reported and run in CI; unit checks are not substitutes for those gates.

Terrain fixes use actual authored materials and measured sprite alpha/contact. Expand the Verdant arch liquid mask only within verified crossing strips; convert only Emberreach's leftover root-channel water to lava. Reproduce Frostmere countryside rock contact before changing pivots/shadows.
