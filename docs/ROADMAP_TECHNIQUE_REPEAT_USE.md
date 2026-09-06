# AUREVANE — Roadmap Integration: Technique Loadouts & Repeat-Use Falloff

**Status:** Binding sequencing companion to `docs/ROADMAP.md` and `docs/GAME_MASTER_PLAN_TECHNIQUE_REPEAT_USE_ADDENDUM.md`.

**Reconciled:** 2026-09-06.

This document supersedes older roadmap/ticket language that describes an 8-pure / 6-mixed selected Discipline Skill loadout or ordinary mature-Skill turn cooldowns.

---

## 1. Current canonical player-facing build rule

```text
SELECTED DISCIPLINE TECHNIQUES = 4 TOTAL

PURE
0–4 from Primary
+ Essence Skill outside those 4

MIXED
up to 4 total across Primary + Secondary
partial 0–3 selections may temporarily come from one active Discipline
full-loadout splits: 1–3 / 2–2 / 3–1
full 4–0 / 0–4 allocations are illegal
+ Resonance passive
```

The mature Discipline library can still grow beyond four learned Techniques. The four-Technique rule is the active combat selection/cockpit capacity, not a limit on how many Skills a Discipline can eventually teach.

Partial mixed selections remain legal so changing Disciplines cannot strand a character in an unreadable or unusable build before the player finishes configuring all four slots. The requirement to use both active Disciplines applies when the four-slot mixed loadout is full.

---

## 2. Current anti-spam rule

Ordinary authored Skills no longer use turn cooldowns.

The battle authority instead tracks the actor's last actual authored Skill command.

- same Skill used consecutively: 50% effect strength;
- different command: resets the repeat chain;
- turn boundary alone: does not reset the repeat chain;
- AP cost stays unchanged;
- state is server-authoritative and reconnect-safe.

Basic-action cooldowns such as the current Recover timer remain separate until explicitly revised.

---

## 3. Immediate implementation checkpoint

The current focused implementation must establish:

- server-authoritative four-slot mixed 1–3 / 2–2 / 3–1 legality;
- legal partial mixed selections during build transitions;
- database and application validation using the same mixed-loadout contract;
- Profile picker filtered to active Disciplines only;
- source/AP/cockpit-type Technique metadata;
- retired cooldown/learned-version clutter removed from Profile cards;
- Build Signature presentation for Resonance/Essence with artwork;
- contextual `Build Signature · Essence Skill` / `Build Signature · Resonance` headings without duplicate type prefixes in the signature name;
- pure Active Build labels using the Discipline name without a redundant `Pure` suffix;
- repeat-use marker in authoritative battle state;
- 50% effect transformation used by both preview and execution;
- no mature-Skill cooldown lockout on the canonical combat path;
- repeat state surviving serialization/reconnect;
- focused automated coverage.

---

## 4. Follow-up schema cleanup

After the runtime migration is proven, schedule a contained cleanup that removes legacy mature-Skill cooldown authoring metadata and stale tooling fields.

That cleanup should include, as applicable:

- `MatureSkillDefinition.cooldown`;
- PvE/PvP cooldown override fields;
- Master Panel cooldown fields for authored Discipline/Essence Skills;
- stale tests asserting mature-Skill cooldown lockout;
- stale player-facing documentation/tooltips;
- analytics/event names that imply cooldown readiness for authored Skills.

Do not remove the generic cooldown utility if a still-authorized basic action or exceptional future mechanic uses it.

---

## 5. Balance and product validation

The repeat-use system should be validated for:

- whether 50% is a strong enough anti-spam incentive without making emergency repeat plays pointless;
- healing/recovery loops;
- status-heavy Skills where one-stack effects round down to zero on the repeated use;
- Resonance setup/payoff clarity;
- pure Essence repeat behavior;
- AI understanding of repeat penalties;
- PvP readability and counterplay;
- long-form PvE where repeated-use pressure should encourage rotation rather than force a rigid rotation.

If later evidence changes the 50% coefficient, change it through a versioned authoritative rule rather than per-client behavior.

---

## 6. Content authoring direction

Future Technique authoring should assume:

- no ordinary cooldown safety valve;
- AP cost, requirements, targeting, positioning, setup/payoff and repeat-use falloff must carry the tactical balance;
- Skills need distinct cockpit roles and readable purpose tags;
- a Discipline library should provide enough tactical variety that choosing four Techniques is meaningful;
- Essence and Resonance should reinforce pure/mixed identity without becoming hidden extra slot taxes.

---

## 7. Phase sequencing impact

This rule change does not authorize unrelated later-phase systems.

It is a reconciliation of the existing Phase-3 buildcraft/combat foundation. Soulmarks, Mantles, expedition-scale systems and other later roadmap work remain in their existing phase order unless separately authorized.

When older Phase-3 ticket language says “generic cooldown engine” for mature Skills, read the current implementation goal as:

> preserve reusable cooldown infrastructure where still legitimately needed, while authored mature Skills use the authoritative consecutive-use effectiveness system defined by the 2026-09-06 addendum.
