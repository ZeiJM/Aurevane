# AUREVANE — Roadmap Addendum: Referrals, Recruitment & Reward Milestones

**Authority:** Binding roadmap integration for `docs/REFERRALS_RECRUITMENT_REWARDS.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`, `docs/ROADMAP_PRODUCT_VALIDATION.md`, `docs/ROADMAP_SOCIAL_RELATIONSHIPS_NOTIFICATIONS.md`, `docs/MONETIZATION.md`, and `docs/MASTER_PANEL.md`.

**Direction approved:** 2026-08-17.

This module schedules player referrals without disturbing current Phase-2 combat work and without launching an acquisition incentive before AUREVANE has proved that new players actually want to stay.

The roadmap rule is:

> **Build the referral attribution/anti-abuse foundation when the living world and notification systems exist; launch the rewarded program only after the first-session/return loop has enough evidence to justify asking players to recruit friends.**

---

# Current Phase 2 — No Referral Implementation

Do not implement referral codes, invite links, qualification counters, referral rewards, or referral UI during current P2.6/P2.7 combat work.

Current compatibility requirements only:

- stable authenticated account principal remains the owner identity for future referral records;
- public character identity remains separate from private account identity;
- account creation flow must remain capable of accepting an optional opaque referral attribution later;
- no raw user UUID is exposed as a shareable referral identifier;
- current progression telemetry remains server-authoritative enough to later verify qualification milestones.

Referral work is not a PV-1 dependency.

---

# Phase 5 — Referral Attribution & Qualification Foundation (Feature-Flagged)

Phase 5 introduces the Living World, News, Notifications, World Pulse, events, presence and the first meaningful return-loop testing. This is the first sensible point to add the **technical referral foundation**, but the public reward program should remain disabled until product quality is ready.

## A. Referral identity foundation

Add server-owned account-linked referral identity:

```text
stable account principal
→ referral profile
→ opaque public code/link
```

Requirements:

- one active public referral code per eligible account;
- code resolves server-side to account identity;
- no raw UUID exposure;
- code rotation without detaching existing recruits;
- no client-submitted arbitrary `referrer_account_id` trust.

## B. Attribution boundary

Account creation / first-entry flow becomes capable of storing one referral attribution.

Recommended policy:

- referral link/code may bind at signup or during a short grace period;
- production planning target: within ~48 hours and before a small early progression cutoff such as Level 5;
- one recruit account may have one referrer;
- ordinary player UI cannot change referrer after binding;
- tightly controlled support correction only with audit.

Do not yet redesign onboarding around referral marketing.

## C. Qualification engine

Add a server-side qualification evaluator capable of a composite milestone such as:

```text
verified account
+
3 distinct active days across >= ~72 real hours
+
initial target around Level 15
+
first meaningful authored active-play checkpoint
+
no disqualifying abuse state
```

Exact values remain configuration/tuning data.

Wayfarer's Practice/offline XP alone cannot satisfy active-play qualification.

No real-money purchase is required.

## D. Anti-abuse risk foundation

Integrate referral qualification with available account/security abuse signals.

Requirements:

- same IP alone never automatically rejects a referral;
- allow legitimate households/shared networks;
- multi-signal risk evaluation;
- explicit Pending / Qualification Met / Risk Review / Qualified / Rejected state;
- bot/ban-evasion/fraud accounts can be invalidated;
- qualification and reward state transitions are auditable;
- privacy-sensitive risk data does not leak to the recruiter.

## E. Notification compatibility

The Phase-5 Notification system becomes capable of later delivering:

- recruit qualified;
- referral milestone reached;
- reward ready to claim.

Do not create noisy per-level/per-login referral notifications.

## F. Feature flag

Referral acquisition/rewards must be independently enableable.

The technical foundation may ship dark while PV-3 is still being evaluated.

### Phase-5 referral gate

Before launch can be considered:

- opaque code attribution works correctly;
- one recruit cannot attach to multiple referrers;
- qualification is computed from authoritative gameplay/activity;
- offline/idling alone cannot qualify;
- shared-household test cases do not fail solely due to shared IP;
- duplicate qualification is impossible;
- abuse state can hold/reject without corrupting account progression;
- feature can remain disabled without affecting normal signup/gameplay.

---

# Product Gate — Do Not Reward Acquisition Before PV-3

The public rewarded referral program should **not launch simply because the code exists**.

Preferred launch prerequisite:

> PV-3 / First-Session & Return-Loop evidence shows that the representative game experience is coherent enough that asking players to invite real friends is responsible and commercially useful.

If new players are still mainly quitting because onboarding/world/combat is confusing, fix the product first.

Referral rewards should amplify organic recommendation, not purchase temporary growth for an unready game.

---

# Phase 6 — Public Referral Program Launch + Friends Integration

**Primary player-facing referral milestone**, assuming the product gate above is satisfied.

Phase 6 already introduces Friends, Party and Co-op, making referrals naturally part of the social hub rather than an isolated marketing page.

## A. Invite Friends / Referrals surface

Add a polished social/account destination showing:

- referral code;
- Copy Code;
- Copy Invite Link;
- qualified recruit count;
- pending/progressing recruit count without private detail;
- 1 / 3 / 5 / 7 / 10 milestone track;
- reward claim state;
- referral rules / qualification explanation;
- anti-abuse terms link.

Do not show a recruit's exact level, play time, quest progress or fraud/risk state to the referrer.

## B. Core milestone reward track

Publish versioned account-bound rewards at:

```text
1
3
5
7
10
```

Recommended launch direction from `docs/REFERRALS_RECRUITMENT_REWARDS.md`:

### 1 — First Footfall

- Wayfinder's Mark profile/nameplate presentation;
- referral banner/emblem.

### 3 — Road Companion

- exclusive non-authority earned title;
- social/profile flourish;
- future Homestead referral trophy entitlement.

### 5 — Pathfinder Cache

- one Referral Cosmetic Choice Voucher from an approved mid/premium cosmetic catalog.

### 7 — Waymaker Cache

- higher-tier Referral Cosmetic Choice Voucher;
- approved Identity Service Token such as Title Reforge when available;
- future Homestead referral furnishing set.

### 10 — Roadbringer Legacy

- **Grand Referral Choice Voucher** for one complete premium-quality cosmetic bundle/set from an Owner-curated eligible catalog;
- exclusive account-wide Roadbringer referral prestige presentation package;
- unique future Homestead centerpiece/trophy;
- one approved account-service choice from a controlled monetization-safe list.

The exact names may change during naming/art review.

The reward **classes and anti-power rules do not**.

## C. 10-recruit value requirement

Ten Qualified Recruits is difficult and valuable.

The final milestone must not be a cheap badge-only reward.

Target:

> meaningful premium-purchase-equivalent cosmetic/service value, roughly comparable to one full premium appearance bundle.

An internal initial planning target around **$25–30 USD retail-equivalent value** for the Grand Choice component is acceptable, configurable, and not a cash entitlement.

The reward remains:

- non-transferable;
- non-tradeable;
- no cash value;
- no premium-balance conversion;
- no combat/progression/economy power.

## D. Recruit welcome

Optionally launch the modest two-sided **Traveler's Welcome** cosmetic after the recruit qualifies.

Keep it small enough that creating fake recruits is not attractive on its own.

## E. Friends integration

Once the recruit has an account:

- allow Add Friend through the normal friend-request flow;
- do not automatically create friendship;
- make Invite Friends accessible from the Friends/social family;
- OS/share-sheet integration may be used where supported without uploading the player's address book.

## F. Notifications

Reuse the normal notification system:

- recruit qualified;
- milestone reached;
- reward ready;
- Traveler's Welcome ready.

Choice rewards deep-link into the referral claim surface.

## G. Public rules / spam protection

Publish plain-language referral rules covering:

- no self-referral/alt farming;
- no bots;
- no buying/selling referral completions;
- no compromised accounts;
- no mass unsolicited DM/chat referral spam.

Existing social block/mute/rate-limit/moderation rules apply.

### Phase-6 launch gate

Before enabling rewards publicly:

- a legitimate recruit can join from a link and later qualify naturally;
- a signup does not increment milestone count;
- each recruit increments one referrer's Qualified count at most once;
- reward milestones unlock exactly at 1/3/5/7/10;
- milestone grants are idempotent;
- choice vouchers cannot buy forbidden combat power;
- reward items/services are account-bound and non-tradeable;
- referral spam has enforceable policy and rate-limit coverage;
- referral dashboard leaks no private recruit progression/security data.

---

# Phase 7 — Expedition / Co-op Growth Context

No new referral mechanic is required.

Review whether referred cohorts:

- successfully form parties;
- reach Expeditions;
- retain better/worse than organic cohorts;
- create abnormal party/bootstrap behavior associated with qualification farming.

Referral qualification should **not** require an Expedition clear merely to force new users deeper into the game unless later evidence shows the current early milestone is too easy and this change remains fair.

Do not inflate reward value merely because Phase 7 content exists.

---

# Phase 8 — PvP Safety

PvP is not part of recruit qualification by default.

Reasons:

- new players should not be forced into competitive queues to validate a referral;
- arranged PvP could become a qualification-farming vector;
- referral relationships must not influence matchmaking/rating.

Requirements:

- referral/friend relationship provides no ranked matchmaking preference;
- referral rewards have no Arena Tempering/PvP power;
- Roadbringer/referral prestige icon is clearly non-staff and non-rank authority;
- competitive spectator/profile presentation may show an earned referral title only as normal cosmetic identity.

---

# Phase 9 — Scale / Growth Quality Review

As player population grows:

- load-test referral lookups/count aggregation;
- evaluate referred-signup → qualification conversion;
- evaluate D1/D7/D30 retained referred cohorts when sample size supports it;
- inspect false-positive household cases;
- inspect fraud-review workload;
- tune qualification milestone if legitimate users routinely take too long or bot farms qualify too easily;
- review 200–300 friend cap independently from referral count; referral relationships do not need to remain friendships.

Do not optimize for raw signup count.

The key measure is **real Qualified Recruits who become actual players**.

---

# Phase 10 — Mature Social Sharing & Attention

Integrate referrals cleanly into the mature social world without becoming spammy.

Possible work:

- attractive Invite Friends share card;
- referral code/link from social/profile menu;
- DM composer refuses/restricts repeated unsolicited referral spam according to moderation rules;
- richer claim/collection presentation for earned referral titles/cosmetics;
- notification preference integration;
- support/report flow for referral harassment;
- no `@everyone` referral promotion tools for ordinary players.

Do not create a public 'top recruiters' leaderboard.

---

# Phase 11 — Economy / Trade Guardrails

When Trade House/economy exists:

- referral rewards remain non-tradeable;
- Referral Choice Vouchers cannot be listed, gifted, sold or converted to Crowns;
- referral Homestead cosmetics remain account entitlement/decor state rather than scarce market commodities unless separately reviewed;
- qualification cannot be satisfied by being gifted/traded large value from the referrer;
- monitor suspicious transfer graphs between referrer and recruit where abuse analysis genuinely needs it.

Referral rewards must never become an alternate market-money faucet.

---

# Phase 12 — Homestead Reward Fulfillment

When Homesteads exist, fulfill previously earned referral housing entitlements automatically/claimably:

- 3-recruit wall-map/trophy;
- 7-recruit furnishing/decor set;
- 10-recruit Roadbringer centerpiece/trophy.

Requirements:

- players who earned milestones years earlier receive the same entitlement;
- no need to re-qualify recruits;
- decorations grant no storage capacity, profession output, passive materials, XP, combat buffs or nation advantage;
- relocation preserves these decorations like other owned Homestead cosmetics.

---

# Phase 13 — Master Panel: Referrals / Growth Operations

Add mature Owner operations.

Capabilities may include:

- enable/disable new attribution;
- enable/disable reward claiming separately;
- configure attribution grace period;
- configure qualification milestone within reviewed safe bounds;
- configure/version reward milestone bundles;
- curate Referral Choice eligible catalogs;
- view aggregate conversion/retention metrics;
- inspect account referral history for support;
- risk-review queue;
- approve/reject held referrals;
- support correction with audit;
- invalidate proven fraudulent referrals;
- reissue failed legitimate grants;
- inspect suspicious code/use patterns;
- program kill switch.

Role rules:

- **Game Owner** owns program/reward/fraud configuration;
- **Moderator** may enforce player-conduct referral spam/harassment under normal moderation scope;
- **Content Staff** may prepare approved referral art/copy but cannot alter qualification/rewards/economics unless explicitly granted a narrow reviewed capability;
- **Event Staff** has no default referral-program authority.

Never grant raw database access merely to operate referrals.

---

# Phase 14 — Presentation Polish

Polish referral presentation without turning it into aggressive growth marketing.

Potential work:

- high-quality referral milestone track;
- beautiful copy/share card;
- reward preview art;
- Roadbringer prestige treatment;
- Homestead referral trophy art;
- claim animation/audio;
- responsive mobile share flow;
- accessible milestone/read state;
- restrained notification treatment.

Avoid:

- flashing referral banners on login;
- fake unread badges;
- constant `invite more friends` popups;
- hiding core navigation behind growth prompts.

---

# Phase 15 — Referral Fraud / Security Hardening

Dedicated hardening must cover:

- same-device self-referral;
- legitimate same-household users;
- shared IP/cafe/school networks;
- disposable email/account farms;
- bot qualification;
- synchronized multi-account progression;
- circular referral rings;
- account purchasing/referral completion markets;
- code brute-force/enumeration;
- raw account UUID/referrer injection;
- attribution swapping;
- qualification after cutoff;
- duplicate qualification/count races;
- concurrent milestone claims;
- duplicate grant retries;
- voucher double redemption;
- reward marketplace/trade attempts;
- already-owned reward choices;
- fraudulent-account invalidation/clawback authorization;
- referral notification spam;
- DM/chat referral spam;
- privacy leakage through recruit dashboard;
- program kill-switch and recovery;
- large referral graph/query performance.

---

# Canonical Sequence

The intended implementation order is now:

```text
CURRENT PHASE 2
combat proof only

        ↓

PHASE 5
feature-flagged referral identity + attribution + qualification + anti-abuse foundation

        ↓

PV-3 PRODUCT GATE
prove the game is ready to be recommended

        ↓

PHASE 6
launch Invite Friends / Referrals + 1/3/5/7/10 rewards + Friends/Party integration

        ↓

PHASE 9/10
scale review + mature sharing/notifications/social safeguards

        ↓

PHASE 12
fulfill Homestead referral prestige rewards

        ↓

PHASE 13
Owner Referrals/Growth operations

        ↓

PHASE 15
full fraud/security/load hardening
```

The referral program must never become a reason to weaken AUREVANE's anti-pay-to-win, account-security, privacy, social-safety, or product-validation rules.