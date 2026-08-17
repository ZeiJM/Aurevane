# AUREVANE — Referral Recruitment & Reward System

**Status:** Authoritative growth/social specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/MONETIZATION.md`, `docs/PROGRESSION_RETENTION.md`, `docs/SOCIAL_RELATIONSHIPS_NOTIFICATIONS.md`, `docs/SOCIAL_PRESENCE.md`, `docs/PUBLIC_RULES.md`, `docs/MASTER_PANEL.md`, and `docs/PRODUCT_STRATEGY_AND_COMMERCIAL_VALIDATION.md`.

**Direction approved:** 2026-08-17.

This document defines AUREVANE's player referral program: account-linked invite codes, recruit qualification, anti-self-referral controls, milestone rewards, notifications, fraud review, and roadmap-safe operational rules.

The central rule is:

> **Reward players for bringing real people who genuinely begin playing AUREVANE — not for creating accounts.**

The referral system must create a satisfying social-growth loop without becoming a source of pay-to-win power, tradeable-value farming, spam, or an incentive to manufacture alternate accounts.

---

# PART I — REFERRAL IDENTITY & ATTRIBUTION

## 1. Referral Ownership

Every eligible account may have a server-generated referral identity linked to its stable authenticated account principal.

Conceptually:

```text
REFERRER ACCOUNT UUID
        ↓
SERVER-SIDE REFERRAL RECORD
        ↓
OPAQUE HUMAN-SHAREABLE CODE / LINK
```

The public referral code must **not** expose the user's raw account UUID.

Illustrative presentation only:

```text
Code: AUR-7K4M9Q
Link: /join/AUR-7K4M9Q
```

The exact code format is implementation detail.

The server resolves the code to the referrer account. The client never submits an arbitrary `referrer_account_id` and receives credit merely because it knows another account's identifier.

## 2. One Recruit, One Referrer

A recruited account may be attributed to at most one referrer.

Referral attribution is normally established:

- during account creation from a referral link; or
- by entering a referral code during a short early-account grace period.

Recommended production eligibility window:

- before the recruited account reaches a small early progression cutoff such as Level 5; **and**
- within approximately 48 hours of account creation.

Exact limits remain data-driven.

Once validly bound, the referral relationship is immutable through ordinary player UI.

Support may correct a demonstrable attribution error during a tightly controlled early window, with audit history. Players cannot shop around for a new referrer after seeing reward offers.

## 3. Existing Accounts

Accounts that substantially predate the referral relationship do not become referrals merely because someone later sends them a code.

The program is intended to measure genuine acquisition, not retroactively label existing users.

If a launch campaign deliberately allows a migration exception, it must be explicit, time-bounded, and Owner-configured rather than silently weakening the rule.

## 4. Referral Code Rotation

A player may be allowed to regenerate their public referral code if it is being abused or widely posted somewhere they no longer control.

Rotation:

- invalidates the old code for new attribution;
- does not detach already attributed recruits;
- does not reset milestone progress;
- is rate-limited and audited enough to prevent code churn abuse.

---

# PART II — WHAT COUNTS AS A RECRUIT

## 5. Signup Is Not Qualification

A new account using a referral code becomes a **Pending Recruit**.

It does not immediately increment the referrer's rewarded count.

A recruit counts only after becoming a **Qualified Recruit**.

This is the single most important anti-alt-farming rule in the system.

## 6. Qualified Recruit Milestone

Qualification should prove that the recruited account became a real early player rather than an account-creation artifact.

Recommended initial production rule combines multiple independent signals:

```text
VERIFIED ACCOUNT
+
AT LEAST 3 DISTINCT ACTIVE DAYS
  spread across at least ~72 real hours
+
EARLY CHARACTER PROGRESSION MILESTONE
  initial target around Level 15, tunable
+
AT LEAST ONE AUTHORED ACTIVE-PLAY PROOF
  such as completion of the first meaningful story/world checkpoint
  or equivalent server-authoritative combat/quest milestone
+
NO DISQUALIFYING ABUSE/FRAUD STATE
```

Exact progression values should be tuned against real onboarding data. The milestone should normally take a genuine new player several sessions, not months.

### What does not count as active proof

Qualification cannot be satisfied solely through:

- Wayfarer's Practice/offline XP;
- leaving a browser tab connected;
- account age without play;
- premium purchases;
- transferred/traded items;
- receiving gifts from the referrer;
- developer/test/admin state outside explicitly accelerated non-production environments.

A recruit never needs to spend real money to qualify.

## 7. Why the Milestone Is Composite

Any single check is easy to farm:

- email verification alone is trivial;
- Level 15 alone can be botted;
- three days alone can be idled;
- IP uniqueness unfairly punishes households;
- purchase requirements would be exploitative and exclusionary.

Using progression + distinct active days + an authored play checkpoint makes self-referral materially more expensive while remaining normal behavior for a real recruited player.

## 8. Qualification Does Not Require the Recruit to Stay Forever

Once a legitimate recruit qualifies, later inactivity does not revoke the referrer's honest credit.

The referrer is being rewarded for bringing a real player who genuinely engaged, not for controlling that person's future play schedule.

Credit may only be invalidated later for proven abuse, fraud, ban-evasion, automation, account-farming, or other program violations — not because the recruit simply stopped playing.

---

# PART III — ANTI-SELF-REFERRAL & FRAUD CONTROLS

## 9. No Single-Signal Household Punishment

AUREVANE must deter self-referral without falsely punishing siblings, partners, roommates, schools, gaming cafes, or shared networks.

Therefore:

> **Shared IP address alone is never sufficient to reject a referral.**

Use multi-signal risk scoring and review.

## 10. Risk Signals

Privacy-respecting server-side anti-abuse signals may include, where available and lawful/appropriate:

- same authenticated account or linked account identity;
- repeated device/session identifiers strongly correlating accounts;
- repeated payment-instrument identity when commerce exists;
- unusual account-creation bursts;
- many referred accounts created from the same environment in a short period;
- near-identical automated progression patterns;
- suspiciously synchronized login/action timing;
- circular/collusive referral graphs;
- repeated disposable-account behavior;
- referral accounts that are subsequently confirmed bots, ban-evasion accounts, or fraud accounts;
- abnormal transfer/trade patterns intended to bootstrap qualification;
- known abuse fingerprints from account-security systems.

Signals should produce a risk decision, not an opaque assumption that one household can only contain one player.

## 11. Self-Referral Examples to Reject

The following are program abuse:

- creating alternate accounts for yourself and qualifying them;
- paying/buying fake accounts solely to count as recruits;
- using bots or automation to qualify recruits;
- swapping referrals through organized fake-account rings;
- selling referral completions;
- using compromised accounts;
- repeatedly creating/deleting accounts to manipulate milestone counts.

These rules should be visible in public referral terms in plain language.

## 12. Pending / Held / Qualified / Rejected States

Internally, referral qualification should support explicit state such as:

```text
PENDING
QUALIFICATION_MET
RISK_REVIEW
QUALIFIED
REJECTED
REVOKED_FOR_PROVEN_ABUSE
```

Most legitimate users should move automatically from Pending to Qualified after meeting the rules.

Only suspicious cases need a hold/review.

Do not make every real player wait through a long manual fraud review merely because fraud controls exist.

## 13. Reward Clawback Policy

Before a milestone reward is claimed, a later-proven fraudulent recruit may reduce the qualified count and relock an unearned milestone.

After a reward has been legitimately granted, clawback should be rare and limited to proven referral abuse/fraud rather than ordinary account moderation or inactivity.

Any clawback operation must be server-authoritative and auditable.

Do not remove unrelated legitimately earned player items because one referral later became controversial.

---

# PART IV — REFERRAL REWARDS

## 14. Reward Philosophy

Referral rewards should feel **genuinely desirable** while remaining safe for a competitive persistent RPG.

The strongest referral rewards therefore favor:

- premium-quality cosmetics;
- account-wide presentation;
- exclusive non-authority prestige;
- Homestead decoration/presentation;
- approved account-service tokens;
- player choice among monetization-safe rewards.

Avoid rewarding referrals with:

- character XP;
- Discipline Mastery;
- stat points;
- stronger equipment;
- exclusive combat Arts;
- PvP advantages;
- tradeable rare items;
- large amounts of Crowns/market currency;
- profession XP;
- resource-generation bonuses;
- extra combat actions/loadout power;
- anything that makes recruiting ten people a competitive requirement.

Reward bundles must be account-bound/non-tradeable unless a specific harmless cosmetic system later proves a tradable treatment safe.

## 15. Milestone Track

Core rewarded milestones are deliberately capped at:

```text
1 QUALIFIED RECRUIT
3 QUALIFIED RECRUITS
5 QUALIFIED RECRUITS
7 QUALIFIED RECRUITS
10 QUALIFIED RECRUITS
```

Milestones are cumulative and granted once per account.

The main material reward track ends at 10. This gives the program a satisfying finish line and reduces pressure to turn players into perpetual marketers.

Lifetime recruitment statistics may continue after 10 for private history/optional harmless recognition, but no endless escalating power/economic reward ladder is implied.

## 16. Recommended Reward Ladder

Names are provisional; reward *types and value philosophy* are authoritative.

### 1 Qualified Recruit — FIRST FOOTFALL

Reward:

- exclusive **Wayfinder's Mark** profile/nameplate frame or equivalent visible presentation cosmetic;
- small referral-themed banner/emblem entitlement.

Goal: immediate visible thank-you that feels better than a token handful of currency.

### 3 Qualified Recruits — ROAD COMPANION

Reward:

- exclusive earned social title such as **Trailblazer** / equivalent approved final name;
- referral-themed chat/profile flourish;
- referral Homestead wall-map/trophy entitlement, delivered when Homesteads exist if earned earlier.

The title is a normal earned title, never an Official Badge and never an authority signal.

### 5 Qualified Recruits — PATHFINDER CACHE

Reward:

- one **Referral Cosmetic Choice Voucher** redeemable from a curated monetization-safe mid/premium cosmetic catalog;
- optional exclusive portrait pose/emote if those systems exist.

The voucher is not premium currency, has no cash value, cannot be traded, and resolves only to approved product IDs.

Goal: the player gets something they actually want rather than a fixed cosmetic they may dislike.

### 7 Qualified Recruits — WAYMAKER CACHE

Reward:

- one higher-tier **Referral Cosmetic Choice Voucher** or equivalent premium-quality cosmetic selection;
- one approved **Identity Service Token**, recommended default: a Title Reforge token once that service exists;
- exclusive referral-themed Homestead furnishing/decor set when available.

If the player already owns or cannot use a specific service, the reward flow must offer a safe alternative from an approved equivalent-value referral catalog rather than wasting the milestone.

### 10 Qualified Recruits — ROADBRINGER LEGACY

This should feel genuinely substantial.

Recommended bundle:

1. **Grand Referral Choice Voucher** — redeemable for one complete premium-quality cosmetic bundle/set from an Owner-curated eligible catalog up to a configured value tier;
2. exclusive account-wide **Roadbringer** prestige presentation package (final name subject to naming review): premium profile frame/banner/nameplate treatment and a clearly non-staff emblem;
3. unique **Homestead centerpiece/trophy** commemorating ten legitimate recruits when Homesteads exist;
4. one approved account-service choice, such as Title Reforge / appearance recustomization / another monetization-safe service from a controlled list.

Production value target:

> The 10-recruit reward should feel comparable to a meaningful premium purchase — roughly the value of one full premium appearance bundle rather than a cheap trinket — while granting **zero competitive power**.

If monetary-equivalent planning is used internally, an initial target around a **$25–30 USD retail-equivalent cosmetic/service value** is reasonable for the Grand Choice component, but the actual catalog/value is Owner-configurable and should not be hard-coded into entitlement logic.

The reward has no cash-out, resale, transfer, or marketplace value.

## 17. Why the 10-Recruit Reward Uses Choice

Ten real qualified recruits is difficult and valuable to the game.

A fixed reward risks being worthless to a player whose aesthetic differs from the designer's choice.

A controlled premium-choice voucher provides genuine value while preserving anti-pay-to-win rules because:

- only explicitly commerce-safe cosmetics/services are eligible;
- the voucher cannot buy gameplay power;
- the voucher cannot become transferable premium currency;
- the allowed catalog can evolve without rewriting historical referral counts;
- already-owned-item handling can offer another eligible choice.

## 18. Recruit-Side Welcome Reward

A small two-sided reward is recommended because referral programs convert better when the recruited player also feels welcomed.

After the recruit becomes Qualified, they may receive a modest account-bound **Traveler's Welcome** cosmetic entitlement such as:

- profile/banner accent; and/or
- small Homestead souvenir entitlement for later delivery.

Keep this deliberately smaller than referrer milestone rewards so it does not become the primary reason to self-refer.

Do not grant referral-only combat power or a large economic starter package.

---

# PART V — PLAYER EXPERIENCE

## 19. Referral Surface

Once launched, the social/account experience should provide a polished **Invite Friends / Referrals** surface.

Suggested contents:

```text
INVITE FRIENDS

Your code: AUR-7K4M9Q
[Copy Code] [Copy Invite Link]

Qualified recruits: 4 / 10

Milestones
✓ 1   First Footfall
✓ 3   Road Companion
○ 5   Pathfinder Cache
○ 7   Waymaker Cache
○ 10  Roadbringer Legacy

2 recruits are still progressing toward qualification.
```

Do not expose a recruit's private level, quest state, exact play time, fraud score, or hidden account information to the referrer.

If identities are shown, use only public character identity and privacy-safe rules.

## 20. No Harassment-to-Qualify UX

The referrer should not receive a live checklist such as:

> `Elyra needs 2 more levels. Go tell her to keep grinding.`

That encourages pressure and harassment.

Show broad states such as:

- Joined;
- Progressing;
- Qualified;
- Under review where appropriate without exposing why;
- Not eligible / expired attribution where needed.

The recruited player should be allowed to play naturally.

## 21. Reward Claim UX

Milestone rewards may auto-grant simple fixed entitlements, but choice rewards should use an explicit claim surface.

Requirements:

- exact reward preview;
- eligible choice catalog;
- already-owned handling;
- confirmation before consuming a one-time voucher;
- idempotent grant;
- no expiry after legitimately earning the milestone unless an exceptional program campaign explicitly says otherwise;
- notification when a milestone becomes claimable.

## 22. Notifications

Reuse `docs/SOCIAL_RELATIONSHIPS_NOTIFICATIONS.md`.

Possible notifications:

- `A recruit joined through your invitation.` — optional and privacy-safe;
- `A recruit has qualified.`;
- `Referral milestone reached: 5 Qualified Recruits.`;
- `Your referral reward is ready to claim.`;
- recruited player: `Traveler's Welcome is ready.`

Coalesce repeated events where appropriate. Do not turn every recruit login/level into a notification.

---

# PART VI — SOCIAL & SHARE INTEGRATION

## 23. Friends Integration

Referrals and Friends are separate concepts.

A recruited player is **not automatically a Friend**.

Once the Friends system exists, appropriate surfaces may offer:

- Add Friend after the recruited player joins;
- copy referral link from Friends / Social hub;
- invite a real-world friend who does not yet have an account;
- share referral link through normal OS/share APIs where supported.

Do not require external address-book/contact uploads merely to use referrals.

## 24. Public Sharing

Referral links may be shared outside AUREVANE.

Do not attach private account data to share URLs.

Do not publish a public leaderboard ranking who recruited the most people. Such a leaderboard would incentivize spam, influencer-style farming, fake accounts, and harassment.

If community recognition is ever added beyond the 10 milestone, it should be tasteful, opt-in, and non-power.

## 25. Referral Spam Rules

AUREVANE should prohibit:

- repeated unsolicited referral spam in game chat;
- automated referral messages;
- misleading claims about referral rewards;
- buying/selling fake recruits;
- mass unsolicited DMs containing referral codes.

Chat/DM rate limits and moderation rules apply normally.

---

# PART VII — DATA & SERVER AUTHORITY

## 26. Conceptual Data Model

A clean implementation may require concepts equivalent to:

```text
referral_profiles
  account_id
  public_code_hash / lookup identity
  active_code_version
  created_at

referral_attributions
  recruit_account_id
  referrer_account_id
  attributed_at
  attribution_source
  qualification_state
  qualified_at
  risk_state
  invalidation_reason_code

referral_milestone_claims
  referrer_account_id
  milestone_count
  reward_bundle_version
  claim_state
  granted_at

referral_reward_vouchers
  owner_account_id
  voucher_type/version
  redeemed_product_id
  redeemed_at
```

Exact storage design remains implementation-owned.

## 27. Server Commands

Server-authoritative commands/endpoints should own:

- create/resolve/rotate referral code;
- bind referral attribution;
- compute qualification from authoritative progression/activity;
- transition qualification state;
- compute unique qualified count;
- claim milestone reward;
- redeem referral voucher;
- perform privileged support correction;
- fraud-review decisions;
- audited clawback for proven abuse.

The browser never submits `qualified=true`, reward IDs, count increments, or arbitrary grant contents.

## 28. Idempotency

Referral qualification and reward granting must survive retries/reconnects/jobs without double counting or duplicate grants.

Milestone uniqueness should be enforced by authoritative constraints, not only UI state.

A recruit may increment a given referrer's qualified count once.

A referrer may receive each milestone once.

## 29. Reward Bundles Are Versioned

Each milestone resolves to a published referral reward bundle/version.

Historical grants remain explainable if future seasons change cosmetic choices.

Owner changes to the public reward track should not silently mutate already-consumed choices.

---

# PART VIII — OPERATIONS & MASTER PANEL

## 30. Owner Referral Operations

The mature Master Panel should eventually provide a **Referrals / Growth** operational surface.

Owner-authorized capabilities may include:

- enable/disable the referral program;
- configure attribution grace period;
- configure qualification requirements within safe bounds;
- configure milestone thresholds if the program is deliberately revised;
- edit/publish versioned referral reward bundles;
- manage eligible Referral Choice catalogs;
- view aggregate signup → qualification conversion;
- inspect a referrer and attributed recruit records for support/abuse review;
- view risk flags without exposing unnecessary raw personal data;
- approve/reject held qualification;
- correct legitimate attribution errors with audit;
- invalidate confirmed fraudulent referrals;
- reissue a failed legitimate reward grant;
- disable/refund/revoke a broken reward voucher safely;
- inspect code-abuse patterns;
- export aggregate growth metrics where operationally needed.

Ordinary Content Staff/Event Staff/Moderators do not automatically gain referral reward configuration or fraud-decision authority.

Moderators may receive narrowly scoped referral-spam enforcement context when it is part of player conduct, without access to commerce/security internals.

## 31. Program Kill Switch

Owner operations should include an emergency switch that can:

- stop new referral attribution;
- stop reward claims while preserving earned state;
- leave the rest of the game available.

Do not require taking AUREVANE offline because the referral program is under attack.

---

# PART IX — ANALYTICS & PRODUCT VALIDATION

## 32. Useful Metrics

Privacy-respecting aggregate telemetry may include:

- referral link/code copied;
- referred signup created;
- attribution accepted;
- pending recruit → qualified conversion;
- median time to qualification;
- qualification by cohort;
- suspicious/rejected rate;
- milestone counts/claims;
- reward-choice distribution;
- referred-player D1/D7/D30 return behavior when samples allow;
- ordinary-player versus referred-player retention comparison;
- support/fraud-review load.

Do not treat raw referred signups as success. **Qualified recruits and retained real players** are the meaningful measures.

## 33. Growth Quality Rule

If the program produces many signups but poor qualification/retention, do not simply increase reward value.

Investigate:

- wrong audience;
- spammy acquisition;
- weak onboarding;
- weak core game;
- milestone friction;
- abuse patterns;
- misleading player promotion.

The referral program should amplify a game people already want to recommend, not disguise a weak product loop.

---

# PART X — SECURITY / ABUSE TESTING

## 34. Required Hardening Cases

Before production-scale rewards, test:

- self-referral with same browser/device;
- same household with legitimate separate users;
- same IP with multiple legitimate users;
- rapid disposable-account creation;
- automated qualification;
- referral code brute-force/enumeration;
- raw UUID submission attempts;
- referral attribution swapping;
- attribution after progression cutoff;
- circular referral graphs;
- same recruit counted twice;
- concurrent milestone claims;
- duplicate reward grants;
- already-owned voucher redemption;
- banned/fraud-account invalidation;
- reward clawback authorization;
- blocked/social privacy interactions;
- notification duplication;
- referral spam via DMs/chat;
- program kill-switch behavior;
- data-export/privacy boundaries.

---

# PART XI — DEFINITION OF SUCCESS

The referral system succeeds when:

- players can share a simple referral code/link tied server-side to their stable account ID without exposing that ID;
- a signup alone does not earn rewards;
- real new players qualify through normal active play over multiple sessions;
- self-referral is materially inconvenient and detectable without automatically punishing shared households;
- unique qualified recruits unlock the 1 / 3 / 5 / 7 / 10 milestones exactly once;
- milestone rewards feel premium and desirable while granting no combat/progression/economic advantage;
- the 10-recruit reward feels meaningfully valuable through a full premium-quality choice plus exclusive prestige presentation;
- rewards are account-bound and cannot become a player-to-player value farm;
- recruiters cannot see private recruit progression/fraud information;
- notifications inform without nagging;
- the program can be tuned, reviewed, or disabled safely by the Owner;
- referral growth is judged by qualified/retained players, not vanity signup counts.