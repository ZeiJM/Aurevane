# AUREVANE — Soul States

**Status:** Owner-approved terminology authority for the Soulmarked / Soul-Severed character identity layer.  
**Direction approved:** 2026-09-03.  
**Scope:** Terminology and presentation only unless a later implementation ticket explicitly activates the underlying mechanics.

This document establishes **Soul State / Soul States** as the canonical umbrella term for the persistent character condition surrounding Soulmarks, The Severance, and Mantle eligibility.

It does **not** change the approved mechanics of Soulmarks, The Severance, Mantles, Rekindling persistence, Anomalies, or the Binding-based origin of Soulmarks.

Where older current documents use **supernatural path**, **supernatural fork**, **supernatural state**, **supernatural identity**, or a Character Profile section named **Supernatural** specifically to describe the Soulmarked / Soul-Severed choice, interpret that wording as **Soul State** terminology and update it when the document is next touched.

`docs/GAME_MASTER_PLAN.md`, `docs/LORE_BIBLE.md`, `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, `docs/SUPERNATURAL_SYSTEM_REFINEMENT.md`, and `docs/ANOMALIES.md` retain authority for their existing mechanics and lore except where this document deliberately replaces that umbrella terminology.

---

## 1. Canonical term

The official umbrella term is:

# **Soul State**

Plural:

# **Soul States**

Use it for the persistent condition that determines whether a character is unresolved, Soulmarked, or Soul-Severed.

Do **not** describe Soulmarked and Soul-Severed as two generic "supernatural paths."

Do **not** use "Supernatural" as the player-facing name of the Character Profile section that owns this choice.

The intended player-facing language is personal and identity-driven:

> Some choices change more than how a person fights. They change the state of the soul itself.

---

## 2. Soul State lifecycle

The ordinary lifecycle is:

```text
UNAWAKENED
Soul State not yet permanently resolved.

SOULMARKED
Soul State resolved through a Soulmark.
Ordinarily has one current Soulmark.
Cannot ordinarily use Mantles.

SOUL-SEVERED
Soul State resolved through The Severance.
Cannot ordinarily bind Soulmarks.
May pursue Mantles.
```

**Unawakened** is the unresolved Soul State before the permanent choice. It is not a loophole for Mantle access and does not count as Soul-Severed.

**Soulmarked** and **Soul-Severed** are mutually exclusive ordinary Soul States.

The choice is explicit, heavily confirmed, server-authoritative, auditable, and persists through Rekindling.

---

## 3. Canonical related terminology

Use:

- **Soul State** — umbrella character condition;
- **Unawakened** — unresolved Soul State;
- **Soulmarked** — Soul State associated with a current Soulmark;
- **Soulmark** — the manifested potential itself;
- **The Severance** — the irreversible rite/decision;
- **Soul-Severed** — formal Soul State/adjective;
- **the Severed** — natural shorthand in dialogue or prose;
- **Mantle** — an earned transformation tradition available through ordinary progression only to the Soul-Severed;
- **Anomaly** — Owner-granted exceptional state that may bypass ordinary Soul State exclusivity.

The word **path** may still appear naturally in ordinary prose when someone is literally discussing a life choice or journey, but it is not the formal system category.

---

## 4. Retired umbrella wording

When referring specifically to the Soulmarked / Soul-Severed system, retire these labels from current player-facing and active design language:

- supernatural path;
- supernatural paths;
- supernatural fork;
- supernatural identity path;
- supernatural state machine;
- Supernatural as a Character Profile/build section label.

Preferred replacements:

```text
supernatural path        -> Soul State
supernatural paths       -> Soul States
supernatural fork        -> Soul State choice / Soul State fork
supernatural state       -> Soul State
supernatural identity    -> Soul State identity, Soulmark identity, or Mantle identity as context requires
Supernatural section     -> Soul State section
```

Prefer **Soul State choice** over **Soul State fork** in polished player-facing copy. "Fork" remains acceptable in technical design discussion when describing branching state logic.

---

## 5. What this terminology change does not mean

This is **not** a ban on the ordinary English word **supernatural** across AUREVANE.

It may still accurately describe:

- a supernatural creature;
- a supernatural event;
- an extraordinary magical effect;
- a category of world phenomena when no better setting-specific term exists;
- historical prose whose subject is broader than Soul States.

The change is narrower and deliberate:

> **Soulmarked and Soul-Severed are Soul States, not generic supernatural paths.**

Whenever a more specific AUREVANE term exists — Soulmark, Mantle, Soul State, continuity failure, Unchosen, Drift, Anomaly, etc. — prefer the specific term over vague "supernatural" labeling.

---

## 6. Soulmarks remain governed by the Lore Bible

This terminology change does not alter Soulmark origin.

Per `docs/LORE_BIBLE.md`:

- the ancient Binding altered the metaphysical structure of the world;
- the Closed Horizon creates pressure between actuality and unrealized possibility;
- rare individuals resonate unusually with that pressure;
- Soulmarks manifest from that condition;
- Soulmarks are not pieces, shards, children, or direct fragments of Aurevane.

A Soulmark may still produce extraordinary or supernatural effects. That does not make **supernatural path** the correct system name.

---

## 7. The Severance and Mantles

The exact final metaphysics and cultural rites of The Severance remain protected for their dedicated lore pass.

Current locked mechanical direction remains:

- The Severance is irreversible through ordinary progression;
- it resolves the character's Soul State as Soul-Severed;
- Soul-Severed characters cannot ordinarily bind Soulmarks;
- Soul-Severed characters may pursue Mantles;
- Mantles grant no additional active Skills under the current authoritative refinement;
- Mantle invocation, manifestation, Afterstrain, and attainment remain governed by the current Mantle authority;
- Rekindling does not erase the Soul State choice.

The term **Soul State** must not be used to prematurely invent missing Severance metaphysics.

---

## 8. Anomalies

An Anomaly does not create a third ordinary Soul State.

Anomaly remains a protected Owner-granted exception layer.

Approved exceptional forms may deliberately bypass ordinary Soul State exclusivity, including:

```text
Soulmark + Mantle
Two Soulmarks
Two Mantles
```

Normal players cannot naturally acquire an Anomaly through Soul State progression, the Unwritten Reach, Rekindling, loot, crafting, purchase, RNG, or ordinary quests.

When discussing this rule, prefer:

> **Anomalies may bypass ordinary Soul State exclusivity.**

rather than:

> Anomalies bypass supernatural exclusivity.

---

## 9. Character Profile language

When the system becomes player-facing, the Character Profile should use **Soul State** as the section label.

Recommended structure:

```text
CHARACTER PROFILE
├ Attributes
├ Disciplines
├ Soul State
│  ├ Unawakened / Soulmarked / Soul-Severed
│  ├ Soulmark + branch
│  └ OR Mantle + attained invocation levels
├ Equipment
├ Loadouts
└ Prestige
```

Example copy:

```text
SOUL STATE
Unawakened

Your Soul State has not yet been permanently resolved.
```

```text
SOUL STATE
Soulmarked

Current Soulmark: [name]
```

```text
SOUL STATE
Soul-Severed

The Severance is permanent.
Mantle traditions may be pursued when their requirements are met.
```

Do not present Soul State as a generic magic-school selector.

---

## 10. Future data/API naming

The underlying Soul State runtime is not authorized for early implementation by this terminology decision alone.

When its proper implementation phase arrives, prefer clear stable naming such as:

```text
soulState
UNAWAKENED
SOULMARKED
SOUL_SEVERED
```

Avoid introducing new public/domain identifiers such as:

```text
supernaturalPath
supernaturalState
supernaturalFork
```

Existing unrelated identifiers that use "supernatural" for genuinely broader phenomena do not need cosmetic churn merely because this terminology changed.

Server authority, migrations, validation, snapshots, audit, Anomaly exceptions, PvP legality, and Rekindling persistence must still follow the governing specifications when the system is implemented.

---

## 11. Manual and public-copy rule

Once Soul States are legitimately revealed to the player, public documentation should say **Soul State**.

Spoiler-safe early copy may simply say that Soul States are a later progression layer without explaining Soulmarks, The Severance, or Mantles before their intended reveal.

Preferred concise explanation:

> **Soul State** is a persistent character condition that eventually resolves as Soulmarked or Soul-Severed. The choice carries forward through Rekindling.

Preferred story-facing explanation:

> **Some choices change more than how a person fights. They change the state of the soul itself.**

---

## 12. Documentation drift rule

From this approval forward:

1. new current documentation uses **Soul State / Soul States**;
2. new player-facing copy does not call Soulmarked/Soul-Severed "supernatural paths";
3. current documents should be reconciled when touched;
4. clearly historical snapshots may retain old wording when changing them would falsify history;
5. mechanical meaning must not change merely to perform the terminology migration;
6. future implementation tickets involving Soulmarks, Severance, Mantles, Anomalies, Rekindling persistence, profile configuration, or PvP legality must include Soul State terminology impact in their documentation review.

---

## 13. Definition of success

The terminology is correct when a player can understand:

> **My character has a Soul State. It can ultimately be Soulmarked or Soul-Severed.**

without the system sounding like a generic fantasy "supernatural path" skill tree.

The deeper metaphysics may remain mysterious.

The character identity should not.