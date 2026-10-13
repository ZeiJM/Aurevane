# October 13 World live-presence, portrait, terrain and cursor follow-up

Status: implemented on `agent/world-peer-presence-art-20261013`, based on `50dd719f848d94cde697ee1319e00196c78d8fcd`; final native gates pending. No hosted migration or new deployment. Production remains #884 / `dpl_Giw72hrwPuXeZ4gT6hRMseaLrMyM`.

## Owner scope and resulting changes

- Use the existing 16×18 dark crystal cursor (hotspot 2,2) throughout login/recovery, authenticated pages and ordinary clickable controls. Preserve text entry, disabled, help, drag and resize cues. One canonical public SVG and shared global CSS variable replace the map-only data URL.
- Draw avatars and nameplates on a transparent native-DPR identity canvas. Scenery keeps its 1.5 density cap and terrain budget. Device-aligned portrait edges, thin frames, custom-first images, cover crop, picking, ghost cues, stack handling and one frame clock remain. Sources still impose their intrinsic detail limit.
- Commit movement before building terrain/scene/environment/portrait presentation. Matching command retries still present the captured raw authority; clocks, version/conflict checks, training materialization and database movement/battle blocking remain intact. This reduces work before the first acknowledgement, without extending the 600ms unconfirmed preview.
- Receive private Supabase scene invalidations containing only an empty payload. Peer-only reads run independently of pending movement, coalesce bursts, reject obsolete character/version/scene receipts and never reset the owner's movement clock. Polling remains the compatibility/disconnect fallback.
- Render peers from at most 12 server-approved legal, known, supplied route steps and their database clock. Preserve forward phase across unequal delivery delays when approved directions agree; stale/offline/stopped/replaced/withheld/malformed/suspended motion has explicit guards. Base persisted positions and attackability remain authoritative and separate from animation.
- Fill Verdant's measured transparent bridge arch only inside proved liquid strips, using the river's world-anchored depth, texture and current. Both crossing axes and lava share the same material/phase. Count tiny bridge surfaces in the existing terrain cache and include neighboring profile dependencies in its key.
- Convert only Emberreach's leftover root-channel water to lava; preserve roads/collision. Suppress the incorrect padded tree fallback while the correct rock sheet loads. Loaded Frostmere countryside rocks at 35/100/140% retain their measured floor/pivot/shadow.

## Additive migration awaiting Owner approval

`supabase/migrations/20261013131048_world_live_presence.sql` adds a private per-character scene registry, service-only scene/live readers, a narrowly granted receive-policy helper, a SELECT policy on `realtime.messages`, and an authoritative version-change trigger sending empty private notifications to distinct old/new scene topics. It does not alter travel/encounter functions or existing saved character positions.

Registrations hold at most 25 server-derived scene IDs, expire after two minutes and bind to the matching owned World version. Identical reads do not rewrite the row; version/scene changes update it, and a 35s client renewal extends near-expiry registrations. Browsers cannot widen registrations or publish World notifications. Live reads recheck current ownership, version, expiry and discovery before images/serialization. Supabase caches socket receive authorization at join/JWT refresh; already-joined old channels receive empty invalidations only, while their HTTP reads fail closed.

The app enables this path only after the v2 reader succeeds; only missing-function codes permit old-reader fallback. Permission and other persistence errors fail closed. Applying this migration to the hosted project requires the explicit approval retained in the Owner's handoff. Automatic Vercel Git deployments remain disabled.

## Evidence and reviews

Focused regressions were observed failing before fixes for pre-commit enrichment ordering, portrait density, route privacy and approved-clock phase, bridge opening/material, delayed rock fallback, stale scene registration, neighboring underpass cache invalidation and a pending peer read superseded by an owned tick.

Two independent reviews found and prompted fixes for stale registrations after a version/scene change and a constant-color bridge patch; a second art review added the neighboring profile cache-key guard. The registry privacy repro now returns `registered:false` with empty peers/scenes before re-registration, then only the new scene after it.

Native Canvas used original decoded terrain/sprite sheets for Verdant, Emberreach and actual Frostmere countryside (`atlas:62:5`) at 35/100/140%. Sharp checks original sprite alpha and the production bridge clips/shader. These raster checks are not browser/human acceptance.

## Required remaining gates

- Full root `pnpm check` after the final source freeze: PASS (formatting, lint, eight-package types, 5,166 Vitest tests plus seven Node checks, production build). The fresh command completed with exit0; the final web suite is 2,230 tests and database suite79.
- Exact-head CI, including 31 native pgTAP assertions on the fully migrated disposable Supabase stack.
- Exact-head Living Atlas and full Responsive Browser smoke. The two-account scene case aborts normal observer polling, then requires a real committed player's approved movement through `/api/world/presence`; it records measured delivery latency and native identity draw samples. A cookie-derived disposable account positively joins its registered private topic and must receive an explicit authorization denial for a unique unregistered topic; a timeout cannot pass. Native SQL also attempts a real authenticated Broadcast insert and requires an RLS denial.
- The synthetic 100-person case uses 100 distinct visible anchors and distinct URLs to the actual 400px Wayfarer01 starter crop. It verifies 100 decoded portrait URLs drawn at native identity DPR and keeps the existing <80ms frame p95, water/scenery/cache bounds under mobile high-DPI and 4× CPU throttling. It is not 100 independent uploaded images or live concurrent users.
- Owner migration approval, an authorized release, then bounded signed-in production checks and Owner gameplay acceptance.

Local Chromium and Docker are unavailable; native database/socket/browser evidence must come from the disposable CI environment. Earlier intermediate full test runs caught active red tests while implementers were editing; those runs are not final green evidence. Do not represent these source changes as live before the hosted migration/release is complete.
