# Vercel CPU efficiency implementation plan

**Goal:** Remove demonstrated redundant authentication and background chat work while preserving gameplay and fresh authorization.

**Evidence:** The Owner reports 125% of the 4 CPU-hour Hobby allowance with one player. Current source runs session refresh for public audio and JSON media; chat messages, inbox and private typing continue while hidden, intervals overlap slow requests, and unchanged recent-message refreshes write redundant read receipts. Historical CPU attribution is unavailable through the connected Vercel APIs (schema and billing return 404; only 1-hour runtime logs retained). These defects are demonstrated causes of unnecessary work, not measured shares of the account's total CPU.

**Architecture:** Keep existing server authorization, message cadence and periodic reaction refresh. Use one small chat polling lifecycle for visible-only serial requests, completion-based scheduling and bounded failure backoff. Mark read only when the message cursor advances, retry failed receipts, and never acknowledge a response received while hidden. Exclude only the existing public `/media/` namespace from session refresh in addition to prior static exclusions.

**Constraints:** No database migration, authored-content mutation, combat/timer change, new dependencies or plan upgrade. Production deployment needs an explicit Owner request under AGENTS.md section 14; this task prepares a verified reviewable patch first. Existing dedicated fresh checkout uses `agent/vercel-cpu-efficiency-20261104`.

## Tasks

- [x] Read fresh main, execution policies, current source and Vercel account/project state; confirm automatic deployments disabled.
- [x] Establish baseline: 26 adjacent chat/presence/navigation tests pass.
- [x] Add actual ChatPanel effect/request regressions for hidden mount, hide/resume, serial slow reads, read-receipt deduplication/retry and cleanup. Observe failures before fixing.
- [x] Add visible chat polling lifecycle in `apps/web/src/components/social/chat/chat-polling.ts`; integrate inbox, messages and private typers in `chat-panel.tsx`. Test bounded failure recovery and in-flight hide/unmount boundaries.
- [x] Add matcher tests using the installed Next testing API in `src/proxy.test.ts`; observe public audio/video/JSON failures, then exclude public media in `src/proxy.ts`. Keep application/API routes matched, including similarly named paths.
- [ ] Run focused tests, formatting, lint, types and final `pnpm check`; review the whole diff independently, refresh main and reconcile overlap before a task commit/PR. Required remote CI and native signed-in/browser checks remain gates before release.

## Verification map

The change affects shared proxy scope and chat request lifecycle. Focused tests execute ChatPanel effects with real timers controlled by Vitest and a mocked network boundary; matcher tests use Next's own matcher compiler. Adjacent chat formatting/messages, presence and navigation tests guard current consumers. Full quality checks cover uncertain shared impact; no authored rules or persistence changes justify new database migrations/tests. Signed-in chat phone/browser smoke is covered by existing remote CI rather than fabricated locally if the disposable Supabase/browser environment is unavailable.

## Review focus

Hidden responses must not mark unread messages read; failed receipts retry with no new messages; visibility changes during slow requests must not fork polling; cleanup must prevent rescheduling; API routes and auth callbacks must retain session refresh. CPU savings must not be presented as an unmeasured percentage or as clearing the already-used allowance.

## Implementation evidence

All 55 focused tests pass across six files. The initial ChatPanel reproduction showed 25 message reads during a hidden minute, five overlapping slow requests, thirteen duplicate acknowledgements over thirty seconds, and a dropped failed receipt when subsequent batches were empty. The installed Next matcher compiler independently reproduced four incorrectly intercepted audio/video/manifest paths. All are covered by passing regressions.

Independent read-only review identified one Important gap: typing errors were swallowed before the shared backoff could observe them. A new regression reproduced 25 failed typing requests in one minute; rethrowing after clearing displayed typers activates the bounded retry and verifies normal cadence after recovery. The review's callback-path coverage note is also corrected to use actual `/auth/callback`, recovery and reset routes. No Critical issues or other unresolved findings. Supplementary failed read receipts retry on ordinary message polls so read-receipt service failures cannot delay successful message delivery.

Final changed-file ESLint (from the web package) and full web TypeScript pass. Repository `pnpm check` is in progress; the independent review and focused results do not represent native browser or historical CPU validation. Draft PR creation may run remote verification in parallel; merge/release remains gated on final results.
