# October 8 combat/auth reconstruction verification

This records the reconstructed October 8 work on `agent/combat-auth-reconstruct-20261008`. The Owner explicitly authorized publishing, merging, live database/configuration changes and deployment for testing on October 8. The original ZIP did not contain the missing October 8 source or the exact approved recovery percentage table. The concrete replacement mapping is explicitly new, not recovered evidence.

## Source

- Base/Main: `f49b99f23dc16419c94ede9589e9ebeb662bdfe0`.
- Earlier local auth/readers checkpoint: `7bb363a`.
- Verified local implementation: `c3dc83bb91c51c02e33badb9e9ede0c1d6f320cb`, tree `25dab9412f09f324719ca0b8e91e5dfe042d4215`; followed only by documentation/evidence updates.
- Fresh Main fetch on October 8 at finalization remained at the base SHA; no overlap reconciliation required.

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

[Full replacement table](2026-10-08-percentage-recovery-mapping.md): **38 Skill, 6 Essence, 55 Resonance and 1 summon recovery effect rows**. These are effect-row counts, not counts of distinct definitions. Every previous positive recovery Power becomes the same integer percentage; applications, recipients, costs, cooldowns and unrelated effects are preserved. All old immutable definitions remain resolvable. Published hosted overrides still need a read-only audit before release; catalog append does not overwrite them.

## Verification

| Gate | Result |
| --- | --- |
| Focused packet/recovery/Delayed/reaction regressions | Passed, including RED-before-fix evidence |
| Full repository format/lint/eight-package types/tests/build | Passed, exit 0: **4,401 Vitest tests + seven Node checks**; core 2,513, web 1,731, DB 64, validation 71, audio 17, realtime 3, worker 2 |
| Production dependency audit | Passed: no known vulnerabilities |
| Production-component targeting matrix | 72 cases passed; desktop/mobile PvE/PvP/spectators, tile-corner arrows, Line hover, Ground activation/expiry and reduced motion |
| Ground loop boundary checks | Embers/Arcane Pulse opacity is zero at 0, 1 and 2 complete cycles |
| Protected timing migration integration | 2 PGlite tests passed, old-to-new upgrade, override/history preservation, invalid modes and role grants |
| Whole-branch fresh review | All important findings resolved and remediation approved |
| Exact-head remote CI / disposable Supabase reset / delivered email | PR #849 running; quality and disposable database reset passed; full browser acceptance pending |
| Human gameplay/balance acceptance | Not claimed |

Representative final-source screenshots were visually inspected and retained: [desktop edge arrows](2026-10-08-assets/pve-1366-compass-edges.png) and [mobile active Ground layout](2026-10-08-assets/pve-390-embers-active.png). The active Ground screenshot captures the verified zero-opacity animation boundary; orange footprint and lifetime remain visible. The 72-case matrix was rerun successfully after the final code changes.

The full Owner checklist is retained in [2026-10-08-owner-test-checklist.md](2026-10-08-owner-test-checklist.md). Its boxes remain available for fresh Owner acceptance; automated coverage above is evidence, not a claim of human playtesting. The prior released October 7 checklist remains historical regression context.

Review found and corrected independent packet self-triggering of hit-dependent Resonance, per-packet delayed reactions, lethal delayed DoT ordering and missing pending recovery application counts. Additional fresh checks found missing/off-board Rewind anchor validation and a terrain preview still hardcoding R+1. Historical fixtures explicitly select old recovery versions instead of assuming current-minus-one is always historical.

## Release/configuration delta (prepared, not applied)

1. Push the verified isolated branch and open a draft PR after explicit publishing authorization; Vercel Git deployment is disabled by `apps/web/vercel.json`. Run all applicable exact-head workflows, including `browser-smoke.yml` recovery tests against disposable Supabase/Mailpit or Inbucket. Docker is unavailable in this workspace, so delivered-mail, full DB reset and browser Auth acceptance cannot run here.
2. Inspect any hosted immutable Skill/Essence/Resonance overrides and current timing policy read-only. Reconcile an override through explicit new publication; do not mutate historical rows or silently overwrite Owner content.
3. The source migration is `supabase/migrations/20261008162310_combat_delayed_timing.sql`. It replaces the protected timing publisher's enum validation and appends current Rewind=Delayed while preserving existing mode overrides. Disposable upgrade evidence is required before any authorized hosted migration.
4. After an authorized route release, configure hosted recovery email subject/body from `supabase/templates/recovery.html`. The reset link must be `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}`. The intended canonical site is `https://aurevane.vercel.app/` from the previous release evidence; observe the actual hosted SiteURL/allowlist before claiming agreement. Keep the supported legacy recovery callback and signup confirmation behavior.
5. Local Auth SiteURL is `http://127.0.0.1:3100`; local redirect allowlist also retains localhost/127.0.0.1:3000. CI browser port, capture service and template content path must agree. Production email limits must not be copied from disposable local test settings.
6. Hosted smoke must exercise real delivered email in a fresh browser, scanner GET then explicit Continue, new-password sign-in/old-password failure, replay/expiry and session revocation. Record observed results before release completion claims.

## Authorized release progress

- PR #849 initially published commit `bf5741a4372691ab38ebfb72b36abd2d767e3328`, tree `c5f85f71c11cbae350d552c3f13f8081de558e90`, exactly matching local checkpoint `d40e746`.
- Hosted read-only audit found no published Skill/Essence/Resonance overrides. Timing policy version 4 contains summon/status-removal Instant overrides; the additive migration preserves them.
- Initial Representative Buildcraft run `37814976728` failed strict legacy assertions for flat `Heal [4]` and turn-start Rewind. Browser evidence shows the approved percentage recovery and captured cast-position behavior. Revised assertions retain all scenarios and explicitly require captured 4% HP recovery, one-time HP Hex capture, current resource caps/no revival, and Delayed cast-position Rewind.
- The revised run passed 15 of 17 workflows. UI layout review failed only the stale Siphon Slash flat MP Restore expectation in three viewports; Browser smoke failed six shared identity-color checks because their locator still searched inside tokens after the approved tile-corner move. Assertions now require 7% Instant MP Recovery and check the tile's actual facing indicator while retaining every color comparison and scenario. The prior production-component matrix already verifies tile-corner placement and token/arrow color equality.
- Dashboard sign-in succeeded in the correct Production project. Hosted recovery editing is blocked by the current default email service: Source and Save are disabled, with custom SMTP or a supported paid plan required. No email template change is claimed. Observed SiteURL is `https://aurevane-zeijms-projects.vercel.app/`; its four redirect entries cover that alias and generated project deployment aliases, but omit the canonical `aurevane.vercel.app` alias.
- All applicable checks on the revised candidate remain mandatory before release. No merge, migration or deployment is claimed in this progress receipt.
