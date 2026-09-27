# Combat v5 / Nexus Rebalance Checklist

**Owner:** Nick  
**Working PR:** #754 `agent/combat-rebalance-v5-20260927`  
**Base:** current `main` after Discipline/Technique polish  
**Purpose:** single source of truth for the requested Discipline, Essence, Resonance, Technique Preview, Master Panel, and Manual changes.

## 0. Already completed before this rebalance

- [x] Center Discipline names in the Primary/Secondary selection boxes.
- [x] Remove the trailing `Focus: X and Y.` copy from the top Currently Committed Discipline descriptions.
- [x] Remove Discipline sigils from the lower Current/Preview comparison cards and recenter their content.
- [x] Fix duplicate `Marked` wording in generated Cleanse presentation.
- [x] Add Master Panel per-effect player-facing description overrides, kept presentation-only.
- [x] Restrict Technique Skill Type presentation to **Attack / Recovery / Utility**.
- [x] Present Technique Effects as one bullet per effect line.
- [x] Align the Technique Preview panel top edge with the first row of Technique cards on desktop.

## 1. Canonical combat-v5 authoring model

- [ ] Use a bounded authored **Power 1–20** scale for magnitude-bearing combat effects where appropriate.
- [ ] Keep percentage-based effects explicit rather than forcing them through the 1–20 scale.
- [ ] Allow per-Skill percentage potency, e.g. one Guarded application can reduce damage by 10% while another can reduce it by 15%.
- [ ] Ensure authored Power is converted by the battle formula into actual damage/healing/resource output; the UI must not treat Power as literal final HP damage.
- [ ] Keep all authored magnitude fields bounded and server validated.
- [ ] Preserve historical content versions so already-pinned battles do not silently change.

## 2. Effect duration model

- [ ] Add an authoritative duration to persistent effects.
- [ ] **0 turns** = instantaneous on the current command/turn and omitted from player-facing duration brackets.
- [ ] **1 turn** = begins on the following owner turn and lasts for that one turn.
- [ ] **N turns** = begins on the following owner turn and lasts for N owner turns.
- [ ] Display duration beside each applicable effect line as `[1 Turn]`, `[2 Turns]`, etc.
- [ ] Do not display `[0 Turns]`.
- [ ] Make duration editable in the Master Panel.
- [ ] Make balance budgets account for duration so a longer persistent effect costs more of a Skill's budget.
- [ ] Verify duration semantics for statuses, periodic healing/recovery, DOTs, movement/control, and other persistent effects.

## 3. Cooldown model

- [ ] Retire the current ordinary-Technique `0 turns + consecutive-use falloff` rule for combat v5.
- [ ] Normal authored Technique/Essence cooldowns are **1–3 turns** based on total power.
- [ ] Any Skill with an explicit use **Requirement** has **no cooldown**.
- [ ] Cooldown calculation/tuning must account for damage, effect potency, duration, range, area, utility, and other total Skill value.
- [ ] Make cooldown editable in the Master Panel with the 1–3 bound and requirement-gated no-cooldown rule.
- [ ] Player-facing preview shows the actual cooldown; requirement-gated Skills display no cooldown rather than a fake 0-turn value.
- [ ] Add engine/runtime tests proving cooldown enforcement and owner-turn advancement.

## 4. Discipline Technique rebalance

- [ ] Rebalance all latest enabled Discipline Techniques across the full published roster.
- [ ] Higher AP should generally buy more total power, without scaling so aggressively that high-AP Skills become dominant/almighty.
- [ ] Damage Skills should normally allocate most of their budget to damage.
- [ ] Permit thematic exceptions where a damaging Skill intentionally trades damage for stronger utility/control/status effects.
- [ ] Evaluate each Skill in the context of its entire Discipline kit, not as an isolated card.
- [ ] Utility Skills should spend most/all of their budget on utility effects.
- [ ] Recovery Skills should spend most/all of their budget on healing/MP recovery/defensive recovery.
- [ ] Area, multi-hit, long-range, strong targeting, multiple effects, and long durations must consume budget.
- [ ] Requirement-gated payoff Skills can be stronger because their Requirement already gates access and they have no cooldown.
- [ ] Maintain meaningful distinctions between low-, medium-, and high-AP Skills.
- [ ] Run representative buildcraft at multiple Levels/attribute allocations and protect against obvious outliers.

## 5. Essence rebalance

- [ ] Rebalance every current Essence Skill.
- [ ] Essence Skills should naturally cost somewhat more AP than ordinary Techniques.
- [ ] Essence Skills should feel meaningfully powerful/signature without invalidating the regular Technique kit.
- [ ] Apply the same Power, duration, percentage-potency, cooldown, targeting, and budget rules.
- [ ] Requirement-gated Essence Skills follow the same no-cooldown rule.
- [ ] Preserve versioned Essence history.

## 6. Resonance redesign/rebalance

- [ ] Rebalance every current Resonance.
- [ ] Resonances must be widely varied and thematic rather than cookie-cutter bonus-damage templates.
- [ ] Use setup/payoff tags and Requirements cleanly.
- [ ] Allow Resonance payoffs to use damage, recovery, control, statuses, resources, cleanse, movement, or other bounded effects where thematically appropriate.
- [ ] Account for setup difficulty, payoff specificity, effect potency, and duration when balancing Resonance value.
- [ ] Ensure Resonance setup/payoff behavior remains deterministic and server authoritative.
- [ ] Preserve versioned Resonance history.

## 7. Technique Preview presentation

- [ ] Keep Skill Type limited to Attack / Recovery / Utility.
- [ ] Effects remain one bullet per effect, one line each.
- [ ] Each persistent effect line includes its duration bracket.
- [ ] Effect description/explanation lines remain individually readable.
- [ ] Replace the current `<Discipline> Technique` subtitle with a one-line **flavor line** that brings the Technique to life.
- [ ] Flavor line must be concise and non-mechanical; exact mechanics stay in the rows/effect descriptions.
- [ ] Generate/authenticate flavor lines for every current Discipline Technique.
- [ ] Make the flavor line editable in the Master Panel.

## 8. Essence / Resonance Nexus presentation

- [ ] Active card heading format: `Essence: <Name>`.
- [ ] Active card heading format: `Resonance: <Name>`.
- [ ] Replace long mechanical card descriptions with a concise one-line flavor/summary line.
- [ ] Generate/authenticate one-line flavor text for every current Essence and Resonance.
- [ ] Hovering/focusing the Essence artwork opens a Technique-style detail panel.
- [ ] Hovering/focusing the Resonance artwork opens a matching detail panel.
- [ ] Moving the cursor/focus away closes the detail panel automatically.
- [ ] Essence detail view shows type/cost/cooldown/requirements/effects/range/targeting as applicable.
- [ ] Resonance detail view clearly shows setup Requirements/tags, payoff Requirements/tags, and payoff Effects/durations.
- [ ] Make Essence and Resonance flavor lines editable from the Master Panel.
- [ ] Keep desktop/mobile/keyboard behavior accessible and non-blocking.

## 9. Master Panel authoring

- [ ] Discipline Technique flavor-line editing.
- [ ] Essence flavor-line editing.
- [ ] Resonance flavor-line editing.
- [ ] Existing per-effect player-facing description override remains available.
- [ ] Effect Power 1–20 editing where applicable.
- [ ] Explicit percentage potency editing for percentage-based effects.
- [ ] Effect duration editing.
- [ ] Cooldown editing with the v5 rules.
- [ ] Effects, duration, potency, descriptions, and flavor text must appear in validation/diff/preview before publish.
- [ ] Presentation-only copy must remain unable to modify authoritative combat mechanics.
- [ ] Extend versioned authoring/publication support as needed so Essence and Resonance edits are immutable/auditable like Skill content.
- [ ] No browser-direct writes to private combat-content tables.

## 10. Flavor-line content contract

- [ ] Add one canonical presentation field for short flavor text rather than repurposing mechanical descriptions.
- [ ] Use the same field contract for Discipline Skills, Essence Skills, and Resonances.
- [ ] Plan for **Ascension** and **Severance** to use the same field when those systems become playable.
- [ ] Do **not** invent separate Ascension/Severance authoring systems now; record the compatibility requirement for future implementation.

## 11. Manual / documentation

- [ ] Rewrite the Techniques/Damage/Effects Manual article for combat v5.
- [ ] Document Power 1–20 and how it maps into actual battle output.
- [ ] Document explicit percentage potency.
- [ ] Document effect duration semantics and duration brackets.
- [ ] Document 1–3-turn cooldowns and Requirement-gated no-cooldown Skills.
- [ ] Remove obsolete consecutive-use 50% falloff documentation once the v5 runtime is authoritative.
- [ ] Document Attack / Recovery / Utility classification.
- [ ] Document Essence/Resonance hover-detail behavior and setup/payoff Requirements.
- [ ] Update any affected combat docs/tests so documentation and runtime never disagree.

## 12. Verification and release gates

- [ ] Add/adjust unit tests for Power bounds and formula conversion.
- [ ] Add/adjust tests for per-effect percentage potency.
- [ ] Add/adjust tests for duration timing and expiry.
- [ ] Add/adjust tests for cooldown legality and Requirement exceptions.
- [ ] Add full-roster balance contracts for Discipline Skills.
- [ ] Add Essence balance contracts.
- [ ] Add Resonance uniqueness/balance contracts.
- [ ] Add Technique Preview rendering tests for bullets, duration, Skill Type, and flavor line.
- [ ] Add Nexus hover/focus tests for Essence and Resonance detail panels.
- [ ] Add Master Panel authoring/validation/publish tests for new fields.
- [ ] Run full CI, Skill Engine, Essence, Resonance, Profile Skill Build, buildcraft, layout, desktop, and browser smoke checks.
- [ ] Resolve all failures on the exact PR head before merge.
- [ ] Recheck current `main` for concurrent overlap before merge.
- [ ] Keep Vercel deployment gate locked unless Owner explicitly requests a live deployment.
- [ ] If deployment is requested: deploy exact merged commit, verify live Nexus/runtime health, then relock.

## Concurrency boundary

- PR #755 is a separate draft combat-kernel workstream concerning unbounded repeated effect applications and overlaps several v5 kernel files.
- Do not silently absorb, reset, or overwrite #755. Reconcile explicitly before any merge if both branches are still active.
- Do not broaden this checklist into unrelated Phase 5/story/map work.
