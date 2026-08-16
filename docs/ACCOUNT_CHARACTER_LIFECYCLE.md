# AUREVANE — Account Recovery, Character Roster & Character Lifecycle

**Status:** Approved future-design specification; planning only.

**Conflict-avoidance rule:** This document is intentionally isolated from the active Phase 1 implementation branches. Do not modify or rebase the current account/character implementation merely to consume this plan. Reconcile it against the merged Phase 1 source of truth through focused follow-up tickets.

**Authority:** Subordinate to `docs/GAME_MASTER_PLAN.md`, `docs/AI_DEVELOPMENT_QUALITY_MANDATE.md`, `docs/TECH_ARCHITECTURE.md`, and `docs/ENGINEERING_EXECUTION_STANDARD.md`. For the topics below, this records the newer approved Owner direction.

> **Account access should be recoverable, character identity should feel valuable, and destructive character actions should be difficult to perform accidentally.**

## 1. Account → Roster → Character flow

AUREVANE distinguishes three identities:

- **Account** — authentication/security identity.
- **Character Roster** — the account's owned playable characters.
- **Character** — a persistent public game identity.

Normal flow:

```text
Landing / Sign in
      ↓
Authenticated Account
      ↓
Character Roster
  ↙       ↓       ↘
Play    Create    Manage
```

A successful normal login should enter the **Character Roster** rather than assuming a character exists or sending a new account directly into creation.

## 2. Forgot-password / recovery flow

The sign-in experience must include a clearly available but secondary **Forgot password?** action.

Expected behavior:

1. Player requests recovery with their email address.
2. AUREVANE uses the configured authentication provider's supported password-recovery mechanism.
3. The outward response remains neutral: `If an account exists for that email, recovery instructions have been sent.`
4. The recovery link returns to an AUREVANE password-reset route when securely supported.
5. The provider validates the recovery session/token.
6. Player chooses and confirms a compliant new password.
7. Password is updated authoritatively through the provider.
8. Session invalidation/re-authentication follows the provider/security architecture.
9. Player returns to sign-in and then the Character Roster.

Security requirements:

- do not reveal whether an email is registered;
- rate-limit/restrict abuse appropriately;
- never log reset tokens, passwords, secret-bearing recovery URLs, or provider credentials;
- expired/invalid recovery sessions provide a safe retry path;
- server/provider validation owns password policy;
- recovery must not reveal character information before the account is verified.

## 3. Character Roster

The post-login roster contains **three normal character slots**.

Each slot is one of:

- `EMPTY`;
- `ACTIVE CHARACTER`;
- `PENDING DELETION`.

An active character card may show concise identity information such as portrait, name, level, current/foundation Discipline where appropriate, current location when available, last played, and a clear **Enter World** action.

The roster is an identity/selection screen, not a giant statistics table.

If the player owns no characters, all three slots are visible and creation is invited from an empty slot. The player is not silently forced into the creation wizard.

## 4. Maximum three characters

Normal production accounts support:

> **Maximum 3 characters per account.**

This cap is enforced authoritatively, not only in UI.

A character pending deletion still occupies its slot until deletion actually finalizes. A player therefore cannot mark character three for deletion and immediately create character four during the grace period.

If internal QA/Owner testing eventually needs more than three represented characters, that is an explicit internal/exceptional capability, not a normal player entitlement.

This newer direction supersedes any earlier tentative suggestion that the premium shop might sell extra normal character slots. Do not sell a fourth normal slot unless the Owner explicitly changes this design later.

## 5. Character-name policy

Character names are public persistent identities and require strong quality rules.

Initial production policy:

- minimum **3 characters** after normalization;
- maximum **24 characters** after normalization unless later tuning changes it;
- letters only, with optional single spaces between name parts;
- no numbers;
- no apostrophes;
- no hyphens;
- no underscores;
- no punctuation;
- no emoji;
- no decorative/special symbols;
- no leading/trailing spaces;
- no repeated spaces;
- no blank/whitespace-only names.

The intent is clean character identity rather than gamer-tag formatting.

### Normalization and uniqueness

Before validation/uniqueness checks, the authoritative server should normalize the name using an approved Unicode normalization strategy, trim/collapse whitespace, and derive a case-insensitive canonical comparison key.

`Aldren`, `ALDREN`, and `aldren` are the same identity for uniqueness purposes.

Character names must be **globally unique across the entire playerbase**, not merely unique within one account.

Client-side `Name available` checks are advisory only. Final creation must use a database-level uniqueness boundary or equivalent authoritative constraint so two players racing for the same name cannot both succeed.

### Reserved / inappropriate names

Reject names that are:

- obscene or explicitly sexual;
- slurs/hate terms;
- clearly abusive under the active moderation policy;
- reserved staff/system identities such as `Admin`, `Moderator`, `Owner`, `Support`, `System`, etc.;
- obvious staff impersonation;
- reserved major NPC/lore identities where reuse would create material confusion;
- otherwise blocked by the current name-moderation policy.

Moderation is server-side. The player-facing error can remain concise (`That name is not available. Choose another.`) rather than exposing internal blocklists.

Future renaming must reuse the exact same normalization, uniqueness, moderation, reservation, audit, and historical-identity rules.

## 6. Character creation begins from a roster slot

Expected flow:

```text
Character Roster
      ↓
Choose EMPTY SLOT
      ↓
Character Creation Wizard
      ↓
Final Review
      ↓
Server revalidates:
- account ownership
- slot availability
- 3-character cap
- name validity
- global name uniqueness
- all creation rules
      ↓
Atomic creation
      ↓
Roster / Enter World
```

The server checks current state again at final submit. If another request took the third slot or another player claimed the name while the wizard was open, submission fails gracefully rather than corrupting state.

## 7. 24-hour character deletion grace period

Character deletion is not immediate.

Normal flow:

1. Player opens character management from the roster.
2. Chooses **Delete Character**.
3. UI explains deletion and the 24-hour grace period.
4. Require deliberate confirmation, ideally re-entering the exact character name.
5. Require recent authentication/re-authentication when practical.
6. Server records `deletion_requested_at` from trusted time.
7. Server records `deletion_execute_at = deletion_requested_at + 24 hours`.
8. Character becomes **Pending Deletion**.
9. Roster clearly shows deletion time/status plus **Cancel Deletion**.
10. After 24 hours, an idempotent server process finalizes deletion.

The browser may display a countdown, but server/database time decides deletion eligibility.

## 8. Pending-deletion rules

While pending deletion:

- character still consumes one of the three slots;
- character cannot normally enter the world;
- character remains visible so deletion can be canceled;
- name remains reserved;
- normal offline/progression accrual should not continue in an exploitable way;
- future trade/market/economy mutations must be blocked or deliberately reconciled;
- support/Owner tools can inspect lifecycle state;
- retrying the delete request does not create multiple schedules.

To play the character again, the owner cancels deletion first.

## 9. Cancel deletion

Until finalization begins/completes, the account owner can cancel deletion.

Cancellation must:

- verify ownership;
- be server-authoritative;
- atomically clear the pending schedule;
- preserve all character data;
- restore the character to active roster state;
- be idempotent/retry-safe;
- write lifecycle/audit history where appropriate.

## 10. Final deletion is a lifecycle operation

Finalization must not become a naive cascade that later breaks world history.

As systems exist, deletion policy must account for progression, inventory/equipment, saved loadouts, battles, quests/story, guild/social state, marketplace listings, messages, PvP/rankings, Expedition history, Chronicle records, premium entitlements, moderation/support records, and audit history.

Historical records should reference immutable character IDs instead of depending on a mutable display name. Some historical/tombstone data may need to remain after the playable character is gone so old battle logs, Chronicle entries, moderation evidence, or server history remain valid.

The intended player recovery window is the **24-hour pending-deletion period**. Do not promise restoration after finalization.

## 11. Deleted-name reuse

Names remain reserved throughout pending deletion.

After finalization, use a configurable name-retirement window before ordinary reuse to reduce impersonation/delete-reclaim abuse.

Initial planning default: **30 days** after finalization. Protected historical/staff/major-community identities may be reserved longer through moderation/Owner controls.

Historical references always continue to identify the original character by immutable character ID even if the name is later reused.

## 12. Anti-abuse / account-scope rules

Character deletion must not become a way to:

- repeatedly farm starter rewards;
- reset account-scoped rewards/entitlements;
- escape sanctions;
- launder items/currency;
- bypass seasonal/account limits;
- cycle names for impersonation;
- abandon marketplace obligations;
- duplicate premium goods;
- exceed three simultaneously represented normal characters.

Future reward systems must explicitly distinguish first-account, per-character, per-account, and repeatable grants.

## 13. Character Roster UX standard

The roster should feel like choosing one of the player's persistent heroes.

Requirements:

- portrait-focused, attractive cards;
- three obvious slots;
- concise identity/progression context;
- responsive mobile design;
- keyboard/focus accessibility;
- clear Enter World action;
- destructive controls separated from primary play controls;
- empty slots clearly offer Create Character;
- pending deletion is unmistakable without melodrama;
- show an absolute deletion date/time as well as relative countdown where useful;
- Cancel Deletion is easy to find;
- graceful portrait/media fallback through the media pipeline.

## 14. Future Master Panel/support controls

Authorized future operations should be able to:

- inspect an account's three-slot roster;
- inspect ownership/lifecycle state;
- inspect deletion request/execution timestamps;
- cancel pending deletion for legitimate support reasons;
- force-finalize only through a high-risk authorized workflow when necessary;
- reserve/unreserve names where policy allows;
- handle impersonation/name disputes;
- repair stuck lifecycle jobs;
- inspect lifecycle audit records;
- distinguish account-scoped and character-scoped entitlements.

All privileged actions remain server-authorized and audited.

## 15. Core invariants / concurrency

Exact schema belongs to implementation tickets, but architecture must support these invariants:

- at most three normal non-finalized roster characters per account;
- pending deletion counts toward the cap;
- active/pending names are globally unique;
- finalized names remain unavailable while retirement reservation is active;
- ownership cannot change through a client-supplied account ID;
- deletion timestamps come from trusted time;
- lifecycle transitions are explicit/auditable;
- finalization/cancellation are idempotent.

Concurrency cases that must be tested:

- two accounts submit the same available name simultaneously → only one succeeds;
- one account with two characters submits two creations simultaneously → only one can become character three;
- delete and cancel arrive nearly simultaneously → one valid transition wins cleanly;
- deletion finalizer retries → no duplicate cleanup;
- name check says available but another player claims it before submit → friendly final conflict;
- player tries to enter a character as deletion eligibility/finalization occurs → server lifecycle state wins.

## 16. Required test coverage

Password recovery:

- forgot-password action available from sign-in;
- neutral response for known/unknown email;
- valid, expired, and invalid recovery states;
- password-policy validation;
- successful password update;
- old password no longer accepted under documented provider behavior;
- new password accepted;
- no secret/token leakage;
- rate-limit/service-failure behavior;
- desktop/mobile/keyboard accessibility.

Roster/naming:

- zero/one/two/three-character roster;
- server-enforced cap;
- pending deletion still consumes a slot;
- ownership isolation;
- unowned-character selection rejected;
- 3-character minimum / max-length behavior;
- number/symbol/punctuation/emoji rejection;
- reserved/inappropriate name rejection;
- case/normalization-equivalent duplicates rejected;
- concurrent duplicate-name creation has one winner.

Deletion:

- server-authoritative 24-hour schedule;
- cannot finalize early;
- cannot normally play while pending;
- cancellation before finalization;
- retry-safe cancel/finalize;
- slot unavailable until finalization;
- name reserved during grace period and retirement window;
- lifecycle survives refresh/reconnect/process restart;
- future cross-system references are not silently orphaned.

## 17. Future implementation sequencing

To avoid contaminating active Phase 1 work, implement only after the current account/character branches settle into `main`.

Recommended focused follow-ups:

1. **Password Recovery** — forgot-password, recovery callback/update-password flow, security, UX, tests.
2. **Character Roster + Persistent Slot/Name Authority** — post-login roster, 3-slot cap, character selection, authoritative creation persistence, global name uniqueness, strict name rules/moderation.
3. **24-Hour Character Deletion Lifecycle** — schedule, pending state, cancellation, durable finalization, name retirement, audits, lifecycle hooks.

If the final merged Phase 1 roadmap already contains equivalent tickets, fold these requirements into those tickets rather than building duplicate implementations.

## 18. Known current-work reconciliation note

At planning time, the active account-entry branch already contains sign-in/sign-up but not the requested forgot-password UI. The active character-domain branch contains preliminary name rules and intentionally does not yet own the complete roster/deletion lifecycle.

The preliminary character-name grammar permits some separators that this newer Owner direction now rejects for the future production policy.

Therefore:

> **Do not edit the active Phase 1 branches from this planning patch. Let their current ticket scope settle, then apply this specification against the merged implementation in focused follow-ups.**

This is specifically intended to avoid duplicate auth flows, competing migrations, duplicate character schemas, and conflicts between parallel implementation sessions.