# Combined owner fixes and Essence/Resonance identity — live for testing

Production is READY at https://aurevane.vercel.app since **2026-10-19T06:47:42.438Z / 02:47:42 Trinidad**, deployment `dpl_qrA2tsAzbmKELLwDFyk4h3s9vLiK`. PR [#946](https://github.com/ZeiJM/Aurevane/pull/946) incorporates Account #943 and merges as `2ace05d9684a3cef9f35c527db93c834ee4d50ec`. Its tree `c636324c2f4323ee0c3627878dc4012230582418` exactly matches tested head `1f6a902f10c2e4b5d4eeedd5696273a6e20a466a`. Canonical alias and source are verified. This receipt-only follow-up does not deploy another application.

## Delivered behavior

- Account displays a plain clickable Online Users line beneath Welcome back, with a 52px portrait on desktop/mobile; rail portraits remain separate.
- World large discovery-history writes use LZ4, reducing the reproduced repeated persistence cost without deleting history, extending the 600ms unconfirmed preview or changing movement authority, range, Stop or ownership.
- Barrier resolves the sole captured action group at full HP. Effective HP includes authorized active temporary HP, using contiguous red/grey segments above ordinary max HP. Pending/hidden pools do not leak through text, markup or accessibility attributes.
- Covert protects the establishing cast and pending/active benefits in opposing/spectator Chronicle, clipboard and rail. The generic wording is “X uses a skill.” Owners/allies retain details. Per-instance provenance, replacement/copy handling and shared-lifetime protection prevent refresh disclosure; authoritative active Covert remains effective when another Covert is queued.
- Cleanse omits the repeated eligibility phrase after Instant while preserving genuine conditions and conditional healing.
- The reviewed153Essence/Resonance definitions restore castable single-Discipline pinnacles and passive two-Discipline interactions.131Resonances and5Essences change;17validdefinitions remain. HP payments, self drawbacks, recovery conversions, primed Rewind cash-outs, displacement and constrained tagged-hit riders provide distinct interactions. Ordinary136Skills/fiveBasics, stable IDs, unlocks, media and historical captures are preserved.

## Verification and retries

All17 exact-head workflows pass; run IDs are in the [machine receipt](release-assets/2026-10-19-combined-owner-release-receipt.json). Quality covers11,098Vitest plus7Node checks, formatting/lint, all package types and production builds. Native SQL passes41World and71Social pgTAP cases. Browser results:358fullChromium/278documented skips,73focused/21skips,10Edge/2skips,55Atlas/86skips,49Desktop/26skips,110UI/61skips and8PageFit/7skips. Final independent reviews have no remaining Critical/Important findings. Full local quality passes at `/tmp/all-owner-fixes-serial-quality-20261019.log`; an earlier worker-exit run is retained and is not counted as a pass.

Two bounded retries preserve their failed first attempts and all assertions/timeouts:

- PageFit run39204799632 first exceeds30seconds in one unchanged historical publication test;5,854other web cases and all140DB cases pass, as do all eight actual page-fit browser cases. Independent full CI passes the same324case file. The one same-head retry job117909884754 passes the entire workflow.
- Atlas run39204799561 first passes54cases and fails the synthetic100mobile frame-count deadline. Verified artifact12166075902/SHA256`d213fcd6ac9a0152db727a2e0c707912b6c1aff617e2b6ff4a2fd92b5d04931d` shows a counter published only every60draws: baseline60 requires an observable240to exceed180. The last poll sees180; the final sample reaches240at15.748seconds, with17msdraw P95,101players, five identity paints and2,310,112cache pixels. This supports diagnostic quantization sensitivity, not a purely infrastructural cause or continuous-FPS acceptance. Independent review supports one unchanged-head retry; job117910788854 passes all55enabled Atlas cases with the same throttling/assertions/timeouts. Successful artifact12166273730/SHA256`059d2459ac2fc57309b084cfb94e4131d2f2ebcbd39f9052ea5505f2cb3e1d43` is retained. Improving counter granularity is deferred.

Earlier isolated Account/World candidates' Browser/Atlas failures remain documented in their focused receipts and are not substituted for final combined-head verification. The full final Browser run39204799623 passes the prior World action case and reaches the Edge checks. Oversized full browser artifacts are not downloaded through alternative endpoints; completed job logs and smaller native evidence remain available.

## Production release and data preservation

The exact reviewed World migration is applied. Its tool-generated history version20261019064458 is normalized by a digest-checked compare-and-swap to original CLI source identity **20261019035553_world_state_fast_compression**. The recorded statement matches source exactly. Column compression is `l`; all21World function body/ACL hashes, private table RLS and table ACL match the pre-release baseline. No row/history rewrite occurs.

The compatible app is READY and canonical before catalogue publication. A fresh exact294definition baseline inventory binds the Owner transaction to deployed source `2ace05d9684a3cef9f35c527db93c834ee4d50ec`. Publication finishes by06:49:52UTC. Candidate SHA256 is `d74c7e65bdf8b73560b5d890ba08c776b1a523c300fe3810e88013195a8892f1`; prepared publication SQL SHA256 is `455c586a23b9c4952c550027381382fd388caae05e3d448b8e249598040f085f`. Full readback confirms136exact current changes,136retained old versions,158exact untouched definitions,719history rows,294current, zero drafts, unchanged global policy8 and no mismatches. Reviewed SQL/control artifacts remain prepared source templates; the linked machine receipt is the execution evidence.

After publication, `/`, `/manual`, `/rules`, `/api/foundation/auth-status`, `/game/world` and `/game/character` return HTTP200. The two game routes reach the account gateway without a session; this is not signed-in gameplay proof. Canonical alias remains on the stated deployment. Deployment-scoped warning/error/fatal scan06:41:37.071–06:51:37.071UTC returns no logs.

## Testing and continuation

Refresh the app and start a new battle for newly published definitions; historical captures remain pinned. Check compact Account navigation, full-HP Barrier/grey temporary HP, owner versus opposing/spectator Covert views, and real Essence/Resonance setup/payoff. Test long click paths and direction changes against the live World persistence patch.

Hosted signed-in observation remains blocked by the earlier credential-protection restriction; no bypass is attempted. Native disposable-account browser checks do not establish human physical-phone, multiplayer/load or zero-lag acceptance. Preserve the compatible historical reader even after catalogue pointer rollback, because existing captures can contain the new shared requirement node. Broader Master Task8 remains separate; no phase closure. Git auto deployments stay locked.
