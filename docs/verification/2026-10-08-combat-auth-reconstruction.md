# October 8 combat/auth reconstruction verification

The reconstructed October 8 work is live for testing at https://aurevane.vercel.app/. PR #849 is merged and all 17 exact-head workflows pass. The Owner explicitly authorized publishing, merging, live database/configuration changes and deployment for testing on October 8. The original ZIP did not contain the missing October 8 source or the exact approved recovery percentage table. The concrete replacement mapping is explicitly new, not recovered evidence.

## Source

- Base/Main: `f49b99f23dc16419c94ede9589e9ebeb662bdfe0`.
- Final remote PR candidate: `7d33bd6bd1ab5ca0368bba2a06bc7cda018de481`.
- Final local implementation: `9110bf6379bded6dca985ec93ce845ffa6859cc5`. Both source trees are `d80b486b86ef317d12ba6ac8fde4c0d1cd598a60`.
- Earlier local checkpoints `7bb363a` and `c3dc83bb91c51c02e33badb9e9ede0c1d6f320cb` are superseded by the final candidate.
- PR #849 merge: `45686c7eb84ab864e49ccff4dfbbd97478b5ddeb`, parents base f49b99f and final candidate 7d33bd6; its tree is exactly the tested d80b486 tree.
- Main was refreshed before application merge and again before documentation closeout; no concurrent work was overwritten.

## Implemented behavior

- Scanner-safe on-site password recovery: non-consuming GET, explicit same-origin token-hash verification POST, matching recovery-session marker, password confirmation/length validation and replay/expiry browser acceptance prepared against disposable mail capture. Recovery grants no gameplay entitlement.
- DoT narration preserves completed outgoing turn/round, actual HP-loss receipts, explicit Burn backlash/Poison movement causes and concealed-source privacy. Eight same-source Bleed applications remain independently persisted; no invented stack-cap fix.
- Identical effects group by complete canonical definition and trimmed custom description. Execution arrays and recipient identities remain authored; generated explanations deduplicate only identical meaning.
- New encounter packet policy 1 independently rolls repeated tags with applicable origin exceptions, preserves committed delayed outcomes and original source ordinals, and pays costs/cooldowns once. Ordinary unscaled damage uses a 2,500-basis-point Power coefficient per application. Historical policy omissions retain old formulas/RNG.
- Current-policy delayed effects have a monotonic internal command identity. Ready effects aggregate Absorb/Reflect after original command damage; eligible dependent percentage DoTs settle before lethal Reflect. Internal pending identity/sequence is omitted from live viewers.
- Facing arrows occupy each tile's top-left corner in playable and spectator views. Line hover retains legal cardinal potential reach. Ground loops fade to zero at cycle boundaries and retain static reduced motion.
- Current recovery versions capture each recipient's maximum HP/MP and application amount at cast, including HP Hex once. One to four applications retain the captured amount through maximum changes/reload, cap current gains and never revive. Pending/active icons, Chronicle and copied logs show actual application counts and recorded activation round.
- Normal/Instant/Delayed remain one enum with offsets 1/0/2. The protected SQL timing RPC rejects invalid mode shapes, retains Owner/reason/version/audit protections and appends immutable policy history. Migration defaults current Rewind to Delayed while preserving other overrides.
- Current Rewind captures its cast position before movement, persists it and returns at activation. Missing/off-board anchors are rejected; occupied/rooted/impassable/elevation failures have finite public reasons, and already-at-anchor is a paid no-op. Historical Rewind remains move-first/turn-origin.

## Concrete recovery mapping

[Full replacement table](2026-10-08-percentage-recovery-mapping.md): **38 Skill, 6 Essence, 55 Resonance and 1 summon recovery effect rows**. These are effect-row counts, not counts of distinct definitions. Every previous positive recovery Power becomes the same integer percentage; applications, recipients, costs, cooldowns and unrelated effects are preserved. All old immutable definitions remain resolvable. The hosted read-only audit found no published Skill/Essence/Resonance overrides; catalog append does not overwrite them.

## Verification

| Gate                                                               | Result                                                                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Focused packet/recovery/Delayed/reaction regressions               | Passed, including RED-before-fix evidence                                                                                                 |
| Full repository format/lint/eight-package types/tests/build        | Passed, exit 0: **4,401 Vitest tests + seven Node checks**; core 2,513, web 1,731, DB 64, validation 71, audio 17, realtime 3, worker 2   |
| Production dependency audit                                        | Passed: no known vulnerabilities                                                                                                          |
| Production-component targeting matrix                              | 72 cases passed; desktop/mobile PvE/PvP/spectators, tile-corner arrows, Line hover, Ground activation/expiry and reduced motion           |
| Ground loop boundary checks                                        | Embers/Arcane Pulse opacity is zero at 0, 1 and 2 complete cycles                                                                         |
| Protected timing migration integration                             | 2 PGlite tests passed, old-to-new upgrade, override/history preservation, invalid modes and role grants                                   |
| Whole-branch fresh review                                          | All important findings resolved and remediation approved                                                                                  |
| Exact-head remote CI / disposable Supabase reset / delivered email | PR #849: all 17 exact-head workflows passed; six disposable captured-mail recovery cases passed; original-sender Brevo delivery confirmed |
| Human gameplay/balance acceptance                                  | Not claimed                                                                                                                               |

Representative final-source screenshots were visually inspected and retained: [desktop edge arrows](2026-10-08-assets/pve-1366-compass-edges.png) and [mobile active Ground layout](2026-10-08-assets/pve-390-embers-active.png). The active Ground screenshot captures the verified zero-opacity animation boundary; orange footprint and lifetime remain visible. The 72-case matrix was rerun successfully after the final code changes.

The full Owner checklist is retained in [2026-10-08-owner-test-checklist.md](2026-10-08-owner-test-checklist.md). Its boxes remain available for fresh Owner acceptance; automated coverage above is evidence, not a claim of human playtesting. The prior released October 7 checklist remains historical regression context.

Review found and corrected independent packet self-triggering of hit-dependent Resonance, per-packet delayed reactions, lethal delayed DoT ordering and missing pending recovery application counts. Additional fresh checks found missing/off-board Rewind anchor validation and a terrain preview still hardcoding R+1. Historical fixtures explicitly select old recovery versions instead of assuming current-minus-one is always historical.

## Production release and hosted configuration

- Deployment **dpl_6jwSR1ejDxgAXBFAX5MR7yQdMkSF** is READY at **2026-10-08T20:36:12.148Z** (16:36 America/Port_of_Spain), with source merge **45686c7eb84ab864e49ccff4dfbbd97478b5ddeb**. The canonical alias https://aurevane.vercel.app/ points to this exact deployment. Previous production deployment dpl_BkvsQJyAv1nVQzqCrHD2bAxJpccV remains the recorded rollback reference.
- Release was explicitly created through the deployment API from the verified merged SHA. `apps/web/vercel.json` retains the full Git deployment lock. This documentation closeout changes no application bytes and triggers no additional deployment.
- Applied `supabase/migrations/20261008162310_combat_delayed_timing.sql` only after the app was READY and canonical alias/public recovery entry were verified. Supabase recorded **20261008203822**, name **combat_delayed_timing**, with success. The executed SQL was compared byte-for-byte to the merged source first.
- Post-apply timing v5 is `{"summon":"instant","remove-status":"instant","return-to-turn-start":"delayed"}`. Prior v4 remains `{"summon":"instant","remove-status":"instant"}`; all five immutable history rows remain. The protected publisher is unavailable to anon/authenticated and available to service_role. Existing Owner/reason/version/enum guards remain.
- Security-advisor baseline is unchanged: INFO `rls_enabled_no_policy` and WARN `auth_leaked_password_protection`. Existing remediation references: [RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No new release advisory is reported.
- Hosted SiteURL is **https://aurevane.vercel.app**. The six-entry redirect allowlist retains prior alias entries plus canonical recovery and legacy callback compatibility. [Saved Auth URL proof](2026-10-08-assets/hosted-auth-urls.jpg).
- Custom SMTP is enabled with **Aurevane RPG <aurevanerpg@gmail.com>**, **smtp-relay.brevo.com:587**, the existing Brevo SMTP login and hidden Owner-entered key. Reload confirms saved settings. The provider's sender list shows the new address **Verified**. No credential was read, committed or copied into chat. Brevo substitutes its sending domain for Gmail; an authenticated owned domain is not claimed.
- The hosted subject **Reset your AUREVANE password** and exact `supabase/templates/recovery.html` body are saved and reload-verified. The link is `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}`. GET does not consume the token; explicit Continue verifies it through the same-origin POST. Signup and supported legacy callbacks remain unchanged.
- Supabase permits **30 emails/hour** with **60 seconds per recipient** retained. Brevo's free account allowance is 300/day. No paid plan or domain was purchased. Tracking anonymity was left unchanged; disabled link rewriting is not claimed.
- No production account/password/gameplay mutation was performed by the release. Valid-token password changes and full authenticated acceptance use disposable CI and the Owner's own testing.

## Public smoke and bounded runtime evidence

Eight canonical checks return HTTP 200: `/`, `/manual`, `/rules`, `/manual/techniques-damage-effects`, `/manual/attributes-derived-stats`, `/auth/recovery?token_hash=0123456789abcdef0123456789abcdef` (non-real placeholder), `/auth/reset-password` and `/api/foundation/auth-status`.

The deployed Manual contains the new 25% Power, 140% hostile damage, worked 22 HP example, captured recovery and Delayed wording. [Live Manual screenshot](2026-10-08-assets/live-manual.jpg) was visually inspected. Placeholder recovery GET displays Continue without a password input and was never submitted. The ordinary reset route exposes no password form without a recovery session. Both Auth responses return `private, no-cache, no-store, max-age=0, must-revalidate` and `Referrer-Policy: no-referrer`.

The exact production deployment's warning/error/fatal scan is bounded from **2026-10-08T20:36:12.148Z** through **2026-10-08T20:45:19.355Z**. The grouped response contains no matching level rows. This is a short post-release window, not an indefinite uptime claim.

## Final exact-head browser evidence

All 17 workflows pass candidate **7d33bd6bd1ab5ca0368bba2a06bc7cda018de481**. Browser smoke run **37830708765**, job **113495845450**, succeeds with:

| Suite                         | Passed | Existing project-specific skips |
| ----------------------------- | -----: | ------------------------------: |
| Master/WASD (two repetitions) |      4 |                               0 |
| Captured-mail recovery        |      6 |                               0 |
| Early training                |      3 |                               0 |
| Focused browser               |     73 |                              21 |
| Full Chromium                 |    322 |                             221 |
| Edge                          |     10 |                               2 |

Recovery includes fresh-browser mail, scanner non-consumption, matching recovery marker, replay/expiry and password-change/session behavior on disposable Auth. This is distinct from production inbox acceptance.

- UI layout review job **113494999373** passes native Profile swipe, 110 layout cases (61 skips), and the directory case (two skips).
- Desktop interaction job **113495000203** passes 48 cases (27 skips).
- Representative Buildcraft job **113494999887** passes 24 browser cases (six skips), required engine/unit checks and disposable database reset.
- Desktop page-fit job **113495000374** passes eight cases (seven skips) after the final 4,401-test quality gate and build.
- Exact-head CI, Essence, Profile/Skill, Skill Engine, Resonance, Foundation/Security, Battle Sessions, Attribute Allocation, Discipline/Build, Wayfarer, Shared Build Snapshots and Living Atlas workflows all pass.

Earlier browser failures were stale expectations for flat recovery, turn-origin Rewind and portrait-contained facing indicators. Assertions were reconciled to current approved mechanics without dropping scenarios; final full suites passed. Final Manual regression checks were observed RED before prose corrections and GREEN after them (12 focused tests).

## Email evidence and Owner acceptance boundary

Earlier default-provider rate limits returned `over_email_send_rate_limit`, not evidence of SMTP outage. After the Owner chose Brevo and saved the secret privately, transactional logs record reset emails delivered to the original configured Gmail address at 15:44, 15:47 and 15:56 America/Port_of_Spain with no bounce. Auth logs show the 2/hour to 30/hour limiter change at 19:43:55 UTC and successful recover requests at 19:44:44 and 19:47:23; rapid retries correctly report the retained 60-second cooldown. The Owner reports the email/reset process works.

The subsequent requested sender change to **aurevanerpg@gmail.com** is Verified in Brevo and persisted in Supabase. A secure ownership prompt reported submission failure, but the actual sender page then displayed Verified; no code inspection or retry was performed. The new template was activated after deployment. **A new-sender/new-template delivery receipt and human new-password/old-password/session-revocation acceptance have not yet been observed.** They are the first Owner test, using a fresh email opened in a private/new browser and explicit Continue. No password or token should be sent in chat.

All [Owner acceptance boxes](2026-10-08-owner-test-checklist.md) remain unchecked for fresh testing. Automated gates and public smoke demonstrate the released implementation; human gameplay, visual and balance acceptance remain separate outcomes. No phase transition or independent multi-tester acceptance is claimed.
