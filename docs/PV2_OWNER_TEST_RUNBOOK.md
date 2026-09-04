# AUREVANE — PV-2 Owner Test Runbook

**Status:** Ready for Owner human validation after Phase-3 implementation closeout.

**Production:** `https://aurevane.vercel.app`

**Do not interpret this document as a PV-2 PASS.** It prepares a repeatable human test and records the questions to answer before Phase 4 is activated.

---

## 1. What is ready

Phase 3 now provides the representative buildcraft slice required to test:

- Primary Discipline identity and base-profile consequence;
- optional mastered Secondary Discipline;
- independent Primary/Secondary attunement commitment;
- pure build capacity: up to 8 Discipline Skills + Essence outside the cap;
- mixed build capacity: 6 total Discipline Skills + Resonance;
- server-authoritative Skill/AP/cooldown legality;
- committed build snapshots shared by Recruit AI and direct PvP;
- saved build-loadout authority without bypassing attunement or legality.

The production PV-2 preparation control is available only to the private Owner tester allowlist. It does not expose service credentials or grant authority to normal browser roles.

---

## 2. Prepare the selected character

1. Sign in at `https://aurevane.vercel.app` using the Owner production account.
2. Select the character you want to use for PV-2.
3. Open **Character Profile**.
4. In the **Validation Preview** card, click **Prepare PV-2 buildcraft test**.
5. Confirm the status reports that **2 representative Disciplines and 14 Skills are available**.
6. Refresh the Character Profile once before configuring the build.

The preparation step grants only the representative mastery/Skill facts needed for this validation slice. It does not mark PV-2 passed.

---

## 3. Pure-build proof — Vanguard

Open **Manage Discipline Skills**.

Expected identity:

- capacity shows `0 / 8` before selection;
- an active **Essence Skill** is shown;
- Resonance is unavailable because no Secondary is active.

Equip these eight Vanguard Skills:

1. Forceful Strike
2. Cleave
3. Guard Break
4. Brace
5. Rally
6. Shield Bash
7. Second Wind
8. Sweeping Strike

Confirm capacity is `8 / 8`, then click **Commit Skill loadout**.

Before changing the build, note:

- whether Vanguard's Primary identity is understandable from Profile;
- whether the eight-Skill capacity is obvious;
- whether Essence feels like a positive reason to remain pure rather than an absence of Secondary;
- whether Skill AP/cooldown/source information is understandable without developer knowledge.

Enter **Battle Hall / AI Sparring** with the committed pure build and play enough turns to use multiple committed Skills and observe cooldown behavior. Confirm the battle uses the committed build rather than Profile draft state.

---

## 4. Mixed-build proof — Vanguard + Lifebinder

Return to **Character Profile** and open **Manage Primary Discipline**.

Set **Proposed Secondary** to **Lifebinder** and preview the result. Confirm the preview clearly reads **Vanguard + Lifebinder** before committing.

Commit the Discipline change. If the authoritative Secondary attunement timer prevents the change because of a recent real build change, record that as part of the test rather than bypassing it.

Refresh Profile after the commit, then open **Manage Discipline Skills**.

Expected mixed identity:

- capacity is `6 / 6` after pruning/selection;
- active Resonance is **Mercy's Edge**;
- Essence is unavailable while a Secondary Discipline is active.

For the representative mixed loadout, keep:

- Forceful Strike
- Brace
- Cleave

Remove:

- Guard Break
- Rally
- Shield Bash

Add Lifebinder Skills:

- Mending Light
- Barrier
- Renew

Confirm capacity is `6 / 6`, then click **Commit Skill loadout**.

Refresh Profile and confirm the six selected Skills persist and **Mercy's Edge** remains the active Resonance.

Enter **Battle Hall / AI Sparring** again and compare the mixed build with the pure build. Focus on whether the change alters real tactical decisions rather than merely changing labels.

---

## 5. Saved-loadout / authority checks

Where the current Profile surface exposes saved build loadouts, verify that saving and re-activating a stored build restores only server-owned legal state.

Important expected behavior:

- a saved loadout cannot bypass Primary/Secondary attunement timers;
- a saved loadout cannot inject unlearned/disabled Skills;
- Resonance/Essence are re-resolved from the authoritative Discipline state rather than independently selected by the client;
- an active battle remains frozen to the build snapshot it started with even if Profile changes later.

Do not deliberately manipulate browser storage, database state, or service credentials during the normal Owner product test; automated authority tests already cover those attack paths.

---

## 6. Direct-PvP check

If a second authenticated player/account is available, enter the existing direct-PvP flow with the committed representative build and verify the same Skill/Resonance/Essence identity is carried into PvP.

If only one human tester is available, record direct-PvP human validation as **not exercised** rather than inventing a result. Automated P3.7/P3.8 tests already verify shared build-snapshot authority; human PvP product evidence can remain separate.

---

## 7. Questions PV-2 must answer

Record concise observations for these questions:

1. Can you explain Primary versus Secondary without consulting documentation?
2. Is the Primary base-stat consequence understandable?
3. Is **pure 8 + Essence** versus **mixed 6 + Resonance** immediately understandable?
4. Are Skill sources, AP costs and cooldowns readable?
5. Did you voluntarily want to try another build/pairing?
6. Did the pure-to-mixed change alter your tactical decisions?
7. Did any combination feel mandatory, pointless, redundant or confusing?
8. Could you configure the build without excessive study/friction?
9. Could you recover from a poor experiment without feeling trapped?
10. What did you find distinctive enough to remember as specifically AUREVANE?

---

## 8. Decision record

After the playtest, record only the evidence actually observed:

```text
BUILD / COMMIT:
DATE:
TESTER(S):
PURE BUILD TESTED:
MIXED BUILD TESTED:
AI SPARRING TESTED: yes/no
DIRECT PVP TESTED: yes/no
TECHNICAL FAILURES:
TOP CLARITY ISSUES:
TOP BUILDCRAFT OBSERVATIONS:
CURIOSITY / EXPERIMENTATION OBSERVED:
DOMINANT / POINTLESS / REDUNDANT OPTIONS:
WHAT WE LEARNED:
DECISION: PASS / ITERATE / INCONCLUSIVE
NEXT ACTIONS:
```

**Phase 4 remains inactive until the Owner records the PV-2 decision.**
