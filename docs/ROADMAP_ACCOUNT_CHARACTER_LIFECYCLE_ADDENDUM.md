# AUREVANE — Roadmap Addendum: Account Recovery & Character Lifecycle

**Authority:** This document is an incorporated addendum to `docs/ROADMAP.md` for the specific topics of password recovery, post-login character selection, character-slot limits, naming quality/uniqueness, and delayed deletion. It does not broaden the scope of any already-active Phase 1 implementation branch.

**Detailed specification:** `docs/ACCOUNT_CHARACTER_LIFECYCLE.md`.

**Conflict-avoidance rule:** Do not modify the current P1.1/P1.2 branches merely to consume this addendum. Reconcile these requirements after the active account/character work has merged, using focused follow-up tickets and the merged code as source of truth.

---

## Phase 1 — Character Foundation additions

Phase 1 must ultimately include, through the current tickets or focused follow-ups as appropriate:

- sign-in and account creation through the approved authentication stack;
- **Forgot password?** access from the sign-in experience;
- secure provider-backed password recovery/reset with neutral anti-enumeration messaging, rate-limit/error handling, and recovery-session validation;
- a dedicated **Character Roster** as the normal authenticated boundary before character creation or world entry;
- exactly **three normal character slots per account**;
- zero-character accounts see the roster with empty slots rather than being silently forced into creation;
- creation starts from an empty roster slot;
- server-authoritative ownership and slot-cap enforcement;
- normal character cards support selection/Enter World plus separate management actions;
- globally unique public character names enforced authoritatively at final creation;
- initial production character-name policy of 3–24 normalized characters, letters plus optional single spaces only, with numbers/symbols/punctuation/emoji rejected;
- server-side reserved-name, staff-impersonation, and inappropriate-name moderation;
- canonical/case-insensitive normalization so formatting tricks cannot create duplicate identities;
- a **24-hour pending-deletion grace period** for character deletion;
- pending deletion continues to consume the character slot and reserve the name;
- pending characters cannot normally enter the world;
- deletion can be canceled safely before finalization;
- durable/idempotent finalization after the server-authoritative deadline;
- initial **30-day deleted-name retirement window** after finalization, configurable later;
- immutable character IDs and deletion/reference rules that do not corrupt future battle, Chronicle, moderation, social, market, or audit history;
- lifecycle/ownership/name race-condition coverage and responsive/accessibility testing;
- player-manual/contextual-help coverage for recovery, roster, naming, deletion, and cancellation.

### Phase 1 acceptance addition

Before Phase 1 is considered fully complete for production account/character lifecycle, a player must be able to:

```text
recover a forgotten password
        ↓
sign in
        ↓
see the three-slot Character Roster
        ↓
create/select an owned character through server authority
        ↓
be prevented from creating a fourth normal character
        ↓
schedule deletion with a 24-hour grace period
        ↓
cancel during the grace period OR allow durable finalization
```

Global name uniqueness and the approved quality/moderation rules must remain correct under concurrent creation attempts.

---

## Recommended follow-up ticket split

Because related Phase 1 work is already being implemented in parallel, prefer focused follow-ups rather than rewriting active tickets.

### P1 follow-up — Password Recovery

Scope:

- Forgot Password entry point;
- recovery request UI;
- provider-backed recovery callback/session handling;
- set/confirm new password;
- neutral email-enumeration behavior;
- error/expired-link/retry paths;
- security + responsive/accessibility tests;
- Account & Security documentation.

Do not mix character schema work into this ticket.

### P1 follow-up — Character Roster, Slots & Name Authority

Scope:

- post-login roster route/surface;
- three normal slots;
- empty/active/pending-deletion slot presentation foundations;
- character ownership selection boundary;
- final persistent character-creation command if not already completed by the merged Phase 1 implementation;
- authoritative 3-character cap;
- global canonical name uniqueness;
- 3–24 character name rules;
- letters/single spaces only;
- reserved/inappropriate name policy;
- concurrency tests for third-slot and duplicate-name races;
- manual/help update.

Do not create a second character model if the merged branch already owns one. Extend/reconcile the merged source of truth.

### P1 follow-up — 24-Hour Character Deletion Lifecycle

Scope:

- schedule deletion from roster management;
- trusted timestamps;
- pending-deletion state;
- slot/name reservation during grace period;
- block normal world entry while pending;
- cancellation;
- durable idempotent finalizer;
- 30-day name-retirement reservation;
- lifecycle/audit records;
- safe future-reference extension points;
- tests for retries, process restarts, ownership, deadline enforcement, and simultaneous transitions;
- support/manual documentation.

Do not implement future guild/market/PvP cleanup before those systems exist. Instead establish explicit lifecycle hooks/contracts that future systems must honor when introduced.

---

## Phase 5 / Social / World integration note

Once richer world/social systems exist, character selection/deletion must preserve meaningful public history. Locations, Chronicle records, discovered identity, social references, and story history must use immutable character identity rather than fragile display-name-only references.

---

## Phase 10 — Social World addition

When guild/friend/message/social-profile systems arrive, explicitly define deletion behavior for:

- guild membership/leadership;
- friend/social references;
- inbox/conversation authorship;
- public profile links;
- blocks/moderation relationships;
- historical display-name snapshots where needed.

Deletion must not make social history corrupt or allow sanction avoidance.

---

## Phase 11 — Economy addition

When marketplace/trading/crafting/economy systems arrive, explicitly define pending/finalized deletion behavior for:

- active listings;
- escrow;
- bound/unbound character items;
- character-scoped currency/state;
- account-scoped entitlements;
- trade obligations;
- starter/repeatable reward anti-abuse.

A pending-deletion character must not be usable as an asset-laundering or duplication mechanism.

---

## Phase 13 — Complete Master Panel additions

The complete Master Panel should include protected character-lifecycle operations:

- account roster inspection;
- ownership/lifecycle inspection;
- pending-deletion timestamps;
- support cancellation of pending deletion;
- high-risk Owner finalization where legitimately needed;
- reserved-name management;
- impersonation/name-dispute handling;
- lifecycle audit history;
- stuck-finalizer repair/retry;
- clear account-scoped versus character-scoped entitlement inspection.

All mutations remain permissioned, server-authoritative, validated, and audited.

---

## Phase 15 — Hardening additions

Before production launch/hardening is complete, explicitly test:

- password-recovery abuse/rate limiting and email-enumeration resistance;
- expired/replayed recovery sessions;
- global character-name race conditions;
- Unicode/case/normalization edge cases;
- inappropriate/reserved-name enforcement;
- simultaneous third-slot creation races;
- deletion/cancel/finalizer races;
- worker/finalizer retry and restart safety;
- deleted-name retirement enforcement;
- attempts to enter/mutate pending-deletion characters;
- future economy/social/PvP reference integrity;
- account-scoped reward/entitlement abuse through character cycling;
- support/Owner lifecycle authorization and audit coverage.

---

## Monetization constraint

The normal three-character limit is part of the intended player-account structure.

Do **not** sell a fourth normal character slot through the Premium Shop unless the Owner explicitly approves a future design change after reviewing progression, identity, economy, PvP, moderation, and anti-abuse consequences.

Cosmetics/account services may remain monetizable only under the separate anti-P2W commerce rules.

---

## Definition of roadmap success

This addendum succeeds when the eventual implementation makes the following feel simple to the player while remaining rigorous internally:

- recovering an account;
- seeing exactly which characters belong to it;
- understanding the three-character limit;
- creating a clean, globally unique public identity;
- entering the world with the intended character;
- safely changing their mind after requesting deletion;
- preventing accidents, impersonation, duplicate names, slot races, reward cycling, and destructive lifecycle corruption.

The system should feel polished and obvious in use, while the server does the difficult ownership, uniqueness, timing, concurrency, and lifecycle work underneath.