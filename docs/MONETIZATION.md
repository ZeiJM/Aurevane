# AUREVANE — Premium Shop, Monetization & Payment Operations

**Status:** Authoritative monetization feature specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/MASTER_PANEL.md`, `docs/OWNER_OVERRIDE.md`, `docs/PLAYER_MANUAL.md`, `docs/ENGINEERING_EXECUTION_STANDARD.md`, and `docs/TECH_ARCHITECTURE.md`.

**Direction approved:** 2026-08-15.

This document defines AUREVANE's optional premium storefront, its anti-pay-to-win rules, the Owner's Master Panel controls, payment/fulfillment architecture, and the initial PayPal integration direction.

The commercial goal is to let players financially support AUREVANE and buy attractive optional goods without making competitive success depend on spending money.

> Monetization should feel like a tasteful extension of the world and account experience, not a toll booth placed in front of gameplay.

---

## 1. Core Monetization Principle

AUREVANE may sell optional premium products for real money, with **USD as the initial store base currency**.

The premium shop must be capable of generating meaningful revenue while preserving the integrity of the six-month character journey, buildcraft, PvE progression, PvP competition, Rekindling, Veteran Edge, live events, and the social world.

The preferred monetization equation is:

```text
DESIRE TO SUPPORT THE GAME
+
IDENTITY / COSMETIC EXPRESSION
+
ACCOUNT CONVENIENCE THAT DOES NOT CREATE COMBAT POWER
+
PRESTIGE / PRESENTATION
=
REVENUE WITHOUT PAY-TO-WIN
```

Do not sell victory.

---

## 2. Store Placement — Quietly Discoverable, Not Deceptively Hidden

The premium shop should be **subtle and non-intrusive**, but it must not be hidden in a deceptive attempt to conceal that monetization exists.

Players who want it should be able to find it naturally. Players who do not want it should be able to play for long periods without being interrupted by sales prompts.

Recommended presentation:

- a small **Support AUREVANE** / **Patron's Exchange** entry inside the account/profile menu;
- an optional premium subsection accessible from a broader Marketplace/Services surface when that UI exists;
- contextual links from cosmetic customization screens when a premium cosmetic is being previewed;
- no mandatory shop visit during onboarding;
- no full-screen store popup on login;
- no flashing purchase button beside normal progression rewards;
- no fake unread notification badges whose only purpose is to force a shop visit;
- no store button occupying the visual priority of Play, World, Character, or active gameplay systems.

The store should be understated, polished, clearly labeled as premium/real-money commerce, and visually consistent with AUREVANE.

---

## 3. Anti-Pay-to-Win Rule

The normal premium catalog must **not** sell direct or disguised competitive power.

Do not sell through the standard premium shop:

- character levels;
- XP or Mastery XP boosts;
- Discipline Mastery;
- Legacy unlocks;
- Confluence unlocks that affect build power;
- Soulmark progression/power;
- stat points;
- stronger equipment or exclusive stat rolls;
- combat consumables unavailable through ordinary play;
- Veteran Edge power or additional active Edge slots;
- ranked rating;
- better matchmaking treatment;
- exclusive meta-defining Arts/Traits/Reactions;
- permanent combat multipliers;
- paid access to a stronger version of a character system;
- cash-only progression skips that bypass the intended long-form journey.

AUREVANE's six-month progression and Rekindling journeys must remain accomplishments, not purchasable shortcuts.

---

## 4. Appropriate Premium Product Categories

Good monetization categories include:

### Character presentation

- outfits/appearance sets;
- alternate approved weapon/armor visual skins where the equipment model supports transmog/presentation separation;
- hair, markings, portrait treatments, poses, and cosmetic appearance options;
- cosmetic auras that do not obscure tactical information;
- nameplate/profile presentation;
- cosmetic spell/Art presentation variants where combat readability remains intact.

### Profile and social prestige

- profile frames;
- banners;
- badges that clearly represent supporter status rather than earned gameplay achievement;
- Hall of Selves visual themes;
- chat/profile flourishes that remain accessible and non-disruptive;
- emotes;
- guild/profile presentation cosmetics when those systems exist.

### World/home/social customization

- personal room/camp/housing decoration if such a feature is implemented;
- cosmetic companions/pets with **no gameplay power**;
- cosmetic town/social-space effects where technically appropriate and non-spammy.

### Account services

- character rename;
- appearance recustomization;
- additional character slots if multiple characters are supported;
- other account-management conveniences that do not improve combat outcomes or progression rates.

### Supporter collections

- themed cosmetic bundles;
- anniversary/supporter packs;
- soundtrack/art-book style digital extras if offered later;
- cosmetic event commemoratives;
- founder/supporter presentation that is distinct from gameplay-earned Chronicle prestige.

Every purchasable entitlement must state whether it is account-wide, character-specific, permanent, consumable, or time-limited.

---

## 5. Competitive Readability Rule

A purchased cosmetic must never become a tactical advantage by making combat information harder to read.

PvP-relevant presentation rules should be able to:

- preserve recognizable silhouettes;
- preserve targeting/facing/status readability;
- normalize or suppress confusing premium VFX in ranked modes;
- enforce effect-intensity limits;
- prevent a purchased skin from disguising an Art, summon, terrain object, hazard, or hitbox;
- offer opponent-side reduced-effects settings where useful.

Visual prestige is allowed. Tactical deception for money is not.

---

## 6. Product Catalog Model

Premium products should be data-driven and versioned.

A conceptual product record may contain:

```text
id
sku
status
internal_name
display_name
description
category
usd_price
product_type
grant_bundle_id
preview_media_ids
account_or_character_scope
purchase_limit
availability_start
availability_end
eligibility_rules
refund_policy_key
visibility_rule
sort_weight
featured_weight
created_at
published_version
```

Product types may include:

```text
COSMETIC_ENTITLEMENT
ACCOUNT_SERVICE
BUNDLE
SUPPORTER_ENTITLEMENT
DIGITAL_EXTRA
```

Do not add product types until a real product needs them.

---

## 7. Premium Grant Bundles

A store product should fulfill through a defined **grant bundle**, not arbitrary client-submitted item IDs.

A grant bundle can contain approved monetization-safe entitlements such as:

- one or more cosmetic entitlement IDs;
- profile presentation unlocks;
- emotes;
- account-service tokens;
- character-slot entitlement;
- supporter badge/presentation state;
- other explicitly approved non-power rewards.

Grant bundles are versioned so a historical purchase remains explainable even if the public catalog later changes.

The payment system must never trust the browser to tell the server what it purchased.

The server resolves the captured provider order to the exact published internal product/version and grant bundle.

---

## 8. Master Panel — Premium Commerce

The Owner must eventually have a dedicated **Premium Commerce** surface inside `/master`.

The Owner can:

- create product drafts;
- edit name/description/category;
- set exact USD price;
- attach approved store art/media;
- select the internal grant bundle;
- define account/character scope;
- set purchase limits;
- make a product permanent, scheduled, seasonal, event-linked, hidden-until-eligible, or retired;
- preview the shop card/detail page before publication;
- publish/schedule/retire products;
- clone a product into a new draft version;
- temporarily disable checkout globally or per product;
- issue complimentary grants without payment through the separate Owner/Support grant systems;
- see purchase/refund/chargeback history;
- view revenue and conversion analytics;
- search transactions by player, order ID, product, date, status, or provider;
- inspect exact fulfillment history;
- retry safe failed fulfillment without capturing money twice;
- issue/reconcile refunds according to supported provider workflows and policy;
- export financial/transaction records where operationally required.

The Owner remains the final authority, but the premium system should make unsafe or pay-to-win catalog choices obvious before publication.

---

## 9. Monetization Safety Classification

Every grantable store entitlement should carry an internal commerce classification such as:

```text
COMMERCE_SAFE_COSMETIC
COMMERCE_SAFE_ACCOUNT_SERVICE
COMMERCE_REVIEW_REQUIRED
COMMERCE_FORBIDDEN_COMPETITIVE_POWER
```

Normal Premium Commerce publication accepts only commerce-safe grants.

If the Owner attempts to attach content classified as gameplay power, the panel should show a strong warning and refuse normal publication unless the underlying classification/rule is deliberately changed through a separate Owner-level content/balance decision.

This is intentionally different from `docs/OWNER_OVERRIDE.md`: the Owner can technically create exceptional game states, but the **monetization product system itself is designed not to become a convenient pay-to-win pipeline**.

---

## 10. Store Rotation and Limited-Time Products

The premium shop may contain:

- permanent staples;
- seasonal cosmetics;
- event-themed cosmetics;
- anniversary products;
- rotating featured collections;
- retired cosmetics that occasionally return.

Limited availability can create excitement, but do not use fake scarcity.

If a product has a real end date, show it accurately.

Avoid:

- fake countdowns that reset;
- fabricated stock limits for digital goods;
- intentionally confusing price anchoring;
- dozens of overlapping timers;
- implying a competitive disadvantage if the player does not buy.

Premium FOMO should remain about style, collecting, and supporting the game—not combat viability.

---

## 11. Initial Payment Provider — PayPal

The initial planned provider is **PayPal**.

As of the approved planning date, PayPal's current REST integration uses the Orders v2 API for server-side order creation/capture, and PayPal provides webhook notifications for payment lifecycle events.

Implementation should use a small internal payment-provider boundary so AUREVANE is not permanently coupled to one vendor.

Conceptually:

```text
PremiumCheckoutService
  └── PaymentProvider
        └── PayPalProvider (initial)
```

Do not build a generic multi-provider framework before a second provider actually exists; define only the narrow boundary required to avoid mixing PayPal-specific payloads throughout gameplay/account code.

---

## 12. PayPal Checkout Flow

The intended high-level flow is:

```text
PLAYER SELECTS PUBLISHED PRODUCT
  ↓
SERVER LOADS CURRENT PRODUCT/VERSION
  ↓
SERVER CREATES INTERNAL PURCHASE INTENT
  ↓
SERVER CREATES PAYPAL ORDER FOR AUTHORITATIVE USD PRICE
  ↓
PLAYER APPROVES THROUGH PAYPAL CHECKOUT
  ↓
SERVER CAPTURES / CONFIRMS PROVIDER RESULT
  ↓
VERIFIED PAYMENT COMPLETION
  ↓
ATOMIC / IDEMPOTENT ENTITLEMENT FULFILLMENT
  ↓
PURCHASE RECEIPT + AUDIT/LEDGER ENTRY
```

Never accept `price`, `sku`, reward IDs, or payment-success claims from the client as authoritative.

PayPal credentials and server tokens remain server-only.

---

## 13. Webhooks and Payment Finality

AUREVANE should receive PayPal webhooks server-side for relevant order/payment lifecycle events.

Webhook processing must:

- use HTTPS;
- verify webhook authenticity using PayPal's supported verification mechanism;
- map the provider event to an internal purchase;
- be idempotent;
- tolerate repeated delivery;
- store provider event IDs where appropriate;
- never fulfill the same purchase twice;
- distinguish pending/approved payment from successfully completed/captured payment;
- record failures for retry/operations review;
- avoid granting products solely because the browser returned from PayPal successfully.

Fulfillment occurs only from a server-verified successful payment state.

---

## 14. Purchase State Machine

AUREVANE should model purchase state explicitly.

A practical initial lifecycle:

```text
CREATED
PAYMENT_PENDING
APPROVED
CAPTURED
FULFILLMENT_PENDING
FULFILLED
FAILED
CANCELLED
REFUND_PENDING
REFUNDED
DISPUTED
CHARGEBACK
```

Not every provider state needs to be copied one-for-one. Internal states should represent the business states AUREVANE actually needs.

State transitions must be validated server-side and transactionally safe.

---

## 15. Idempotency and Double-Grant Protection

Payments and fulfillment are valuable economic operations.

Requirements:

- internal purchase ID before provider order creation;
- provider order/capture IDs stored with uniqueness constraints where appropriate;
- idempotency keys for provider requests where supported/required;
- one fulfillment record per successful purchase/version;
- transaction or equivalent atomic protection around fulfillment;
- safe webhook retries;
- safe user refresh/retry;
- reconciliation job/tool for payments captured but not fulfilled;
- no second grant if capture/webhook arrives twice.

The failure mode "money captured but entitlement missing" must be recoverable without risking "money captured once but entitlement granted repeatedly."

---

## 16. Purchase Ledger and Provenance

Every premium grant must remain explainable.

Persist appropriate records for:

- internal purchase ID;
- player/account ID;
- selected character ID where relevant;
- product ID and immutable/version reference;
- charged amount and currency;
- payment provider;
- provider order/capture reference;
- purchase state;
- timestamps;
- fulfillment transaction ID;
- entitlement IDs granted;
- refund/dispute state;
- operator actions;
- correlation IDs;
- failure/retry history where needed.

Do not store sensitive payment credentials or unnecessary card/payment-instrument data in AUREVANE.

---

## 17. Refunds, Disputes, and Chargebacks

The commerce system must expect refunds and disputes.

The Master Panel should support an operational view that distinguishes:

- completed purchase;
- refund requested;
- refund completed;
- disputed payment;
- chargeback/reversal;
- manual review required.

Entitlement handling depends on product type:

- an unused reversible cosmetic/account entitlement may be safely revoked after refund;
- an already-consumed account service may require manual handling rather than pretending the historical action never occurred;
- historical receipts and audit records are never deleted merely because a refund occurred.

Automated punitive account action should not occur solely from an ambiguous provider event. High-risk dispute/chargeback policy should be explicit and reviewable.

---

## 18. Complimentary and Promotional Grants

Not every premium entitlement must come from a payment.

The Owner can use existing support/Owner grant systems to issue:

- creator/promotional copies;
- compensation;
- contest rewards;
- test grants;
- staff/QA entitlements;
- community prizes;
- customer-support corrections.

These grants retain provenance such as:

```text
PURCHASED
OWNER_GRANTED
SUPPORT_GRANTED
PROMOTIONAL
COMPENSATION
TEST
```

A complimentary grant must not fabricate a fake payment transaction.

---

## 19. Receipts and Purchase History

Players should have a clean **Purchase History** surface showing appropriate information such as:

- product name;
- purchase date;
- amount/currency;
- status;
- entitlement delivered;
- transaction/reference identifier suitable for support;
- refund status where applicable.

Do not expose internal secrets, raw webhook payloads, staff notes, or sensitive provider data.

The player manual should explain how purchases, refunds, missing-entitlement support, and account-bound/character-bound products work.

---

## 20. Premium Store UX Standard

The shop should look premium enough that buying something feels deliberate and trustworthy.

Use:

- high-quality approved artwork;
- clear product previews;
- exact price before checkout;
- precise ownership scope;
- clear "already owned" state;
- clear purchase-limit state;
- clear refund/support links where required;
- responsive and accessible checkout entry points;
- confirmation before leaving/launching external provider approval when useful;
- restrained motion/audio.

Avoid:

- casino-like presentation;
- deceptive button hierarchy;
- accidental-purchase flows;
- confusing virtual-currency conversion in the initial version;
- surprise mandatory bundles;
- hiding the real USD price.

Direct USD pricing is preferred initially because it is simpler, clearer, and easier to audit.

---

## 21. Loot Box / Random Purchase Rule

The initial premium shop should **not** sell randomized paid loot boxes or paid gacha.

Every paid product should tell the buyer what they will receive.

This reduces legal/operational complexity, avoids gambling-like monetization, and better fits AUREVANE's long-term trust goals.

If randomized paid products are ever proposed later, they require explicit Owner approval, a separate legal/product review, probability disclosure design, age/region considerations, and an authoritative plan change before implementation.

---

## 22. Premium Currency Rule

The initial plan does **not** require a premium virtual currency.

Prefer direct USD product pricing for the first production commerce implementation.

A premium currency may be considered later only if it provides a strong product/operational benefit and does not obscure real-money cost.

Introducing premium currency requires a dedicated design covering:

- USD conversion;
- unused balances;
- refunds;
- bonus-currency accounting;
- regional/consumer-law implications;
- purchase history;
- chargebacks;
- expiration rules;
- Master Panel controls.

Do not add it merely because other games have one.

---

## 23. Security Requirements

Premium commerce is a high-value security boundary.

Requirements include:

- server-side product/price authority;
- server-side payment-provider calls where required;
- provider secrets stored only in secure server environment configuration;
- verified webhook handling;
- authorization on all purchase-history and Master Panel operations;
- rate limiting/abuse controls;
- CSRF protections where applicable;
- input validation;
- replay/duplicate-event protection;
- idempotent fulfillment;
- no client-controlled entitlement grants;
- no trust in redirect query parameters as proof of payment;
- protected transaction/audit records;
- structured logging without sensitive payment data.

Do not put PayPal secret credentials into `NEXT_PUBLIC_*` variables or client bundles.

---

## 24. Operational Reconciliation

The Owner should have a **Payments Health / Reconciliation** view.

It should surface cases such as:

- PayPal order created but abandoned;
- approved but not captured;
- captured but fulfillment pending;
- webhook failed/retrying;
- fulfilled but later refunded;
- duplicate provider event safely ignored;
- disputed/chargeback purchase;
- manual intervention required.

A scheduled reconciliation worker can compare unresolved internal purchases with provider state where appropriate.

The goal is that payment problems become visible operational tasks rather than silent player complaints.

---

## 25. Analytics

Premium Commerce analytics should eventually include:

- gross captured USD;
- refunds;
- disputes/chargebacks;
- net recognized commerce metrics as defined operationally;
- purchases by product;
- conversion by store surface;
- repeat purchasers;
- average order value;
- product ownership penetration;
- abandoned checkout rate where measurable;
- refund rate by product;
- purchase/fulfillment failure rate.

Do not build analytics that requires collecting unnecessary personal/payment data.

The Owner can use the Master Panel to compare products and retire weak or problematic offers.

---

## 26. Manual and Transparency Requirements

The comprehensive manual must eventually include a concise **Premium Purchases** section covering:

- where the premium shop is located;
- what kinds of products are sold;
- the no-pay-to-win philosophy;
- whether an entitlement is account- or character-bound;
- purchase history;
- refund/support process;
- missing-purchase troubleshooting;
- cosmetic readability/normalization rules where relevant.

The manual should not market aggressively. It should make the rules easy to understand.

---

## 27. Master Panel Permissions

Potential permissions include:

```text
commerce.view
commerce.products.edit
commerce.products.publish
commerce.products.retire
commerce.analytics.view
commerce.transactions.view
commerce.refunds.manage
commerce.reconciliation.manage
commerce.checkout.disable
```

High-risk commerce permissions should be tightly delegated.

The protected Owner has final authority.

Ordinary Content Editors do not automatically receive payment/refund access.

---

## 28. Feature Flags / Kill Switches

Commerce should have server-enforced controls for:

- global premium checkout enable/disable;
- PayPal provider enable/disable;
- individual product enable/disable;
- account-service purchase disable;
- webhook fulfillment pause with reconciliation queue;
- store visibility enable/disable;
- maintenance messaging.

The Owner should be able to stop new purchases quickly without taking the game offline.

Already captured transactions still require correct reconciliation/fulfillment.

---

## 29. Implementation Timing

### Phase 0 — Foundation awareness

Do not implement commerce prematurely.

Preserve architecture that supports:

- account entitlements;
- authoritative grants;
- provenance/audit;
- server-only secrets;
- idempotent valuable transactions;
- external webhook endpoints later.

### Phase 5–10 — Product/UI preparation

As cosmetics, profiles, social systems, and account customization become real:

- distinguish cosmetic entitlements from gameplay power;
- keep content identifiers stable/versionable;
- ensure premium presentation can integrate without infecting gameplay rules.

No requirement to activate real-money checkout yet.

### Phase 11 — Economy / Commerce Foundation

When the game economy/account systems are mature enough:

- implement Premium Shop catalog/content model;
- implement purchase ledger;
- implement entitlement fulfillment service;
- implement the first PayPal provider adapter;
- implement sandbox checkout;
- implement verified webhook processing;
- implement idempotency/reconciliation;
- implement player Purchase History;
- add initial Premium Commerce Master Panel operations;
- keep the shop understated and non-intrusive.

Real production payments remain disabled until security and operational acceptance are complete.

### Phase 13 — Complete Master Panel Commerce Operations

Add/polish:

- complete product editor;
- scheduled product publication/retirement;
- media preview;
- commerce-safe grant validation;
- transaction search;
- refund/dispute operations;
- reconciliation dashboard;
- revenue/product analytics;
- staff commerce permissions;
- audit history;
- checkout/provider kill switches.

### Phase 15 — Commerce Hardening

Before public real-money launch, validate:

- provider sandbox and production configuration separation;
- payment/webhook authenticity;
- idempotency and duplicate-delivery behavior;
- captured-but-unfulfilled recovery;
- refund/dispute paths;
- permission/security review;
- rate limiting and abuse cases;
- player purchase-history accuracy;
- no pay-to-win grants in the production catalog;
- cosmetic PvP readability;
- applicable merchant, tax, refund, privacy, age, consumer-protection, and regional requirements with appropriate professional guidance where needed.

---

## 30. Definition of Success

The premium system succeeds when:

- players can financially support AUREVANE without feeling forced;
- the shop is easy to find when wanted but does not dominate normal gameplay;
- prices are clear in USD;
- purchased goods are attractive and desirable without creating competitive power;
- a paying player cannot buy their way through the six-month progression journey;
- a non-paying player can compete at the highest gameplay level on equal rules;
- the Owner can create, price, schedule, publish, retire, and analyze premium products from the Master Panel;
- the Owner can stop checkout instantly when necessary;
- PayPal payments are created/captured server-side using the supported production API flow;
- fulfillment happens only after verified successful payment;
- duplicate webhooks/retries cannot duplicate entitlements;
- refunds/disputes remain traceable and operationally manageable;
- every purchase and grant has durable provenance;
- payment secrets never reach the browser;
- commerce does not compromise AUREVANE's game-design integrity.
