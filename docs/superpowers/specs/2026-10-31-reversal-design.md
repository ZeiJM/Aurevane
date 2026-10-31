Owner-supplied Reversal specification, added during the October31 editor/tag batch.

Implementation clarifications:

- The Owner explicitly chose **one trigger per preparation** when asked about the conflicting configurable-trigger wording below.
- Reversal remains separate from Counter. Counter returns actual settled damage; Reversal intercepts one would-be HP packet before mutation.
- Preserve the current approved Reveal rules (Invisible/Covert selection and configured Revealed vulnerability), adding armed Reversal as an independent reason to resolve Reveal. Do not restore the historical Reveal AP surcharge.
- Version1 fixes front/side eligibility, rear bypass, next actual owner-turn start expiry, and one complete owner turn of Strain. Authoring exposes one family and the reflection/attacker-HP/defender-HP percentages. Skill-level costs and cooldown remain authoritative; adding this Tag does not overwrite existing authored costs.
- Dependent hit effects bind to the nearest preceding Damage for the same recipient: negative statuses, DoTs, displacement and negative MP drain. Independent Remove Status, Reveal/Sensory, Terrain and actor utility remain independent. This binding applies only to version1 Reversal interception, not historical captures.
- Reversal return cannot seed Endure's damage bank or another reactive return. Intercepted damage never reaches HP and therefore gives Endure no credit.

The original supplied specification follows.

# AUREVANE — Reversal Tag: Design & Implementation Specification

**Repository:** ZeiJM/Aurevane  
**Objective:** Implement a reusable, balanced Physical/Mystic counterattack Tag for the Master Panel Skill designer and the server-authoritative combat system.

## 1. Overview

Introduce a new combat effect Tag named **Reversal**, inspired by the tactical concept of reflecting an opponent's attack back at them.

Reversal is a high-risk, high-reward defensive ability that requires deliberate preparation, correct positioning, knowledge of Initiative, and sacrificing offensive opportunities.

It must not become a universally effective counterattack, an unavoidable instant reaction, or a source of unrestricted reflected damage.

Reversal must integrate with the existing Controlled timing system, Covert, Reveal, facing, Initiative, AP/MP costs, cooldowns, automatic effects, combat logs, and the Master Panel.

**Important:** Reversal must be a reusable authorable Tag, not one hardcoded Skill. Different Skills may use different Reversal configurations, but each individual Reversal must protect against exactly one damage family.

## 2. Reversal Tag Configuration

Add `Reversal` to the existing Master Panel Tag selector.

Its configuration should include:

| Parameter | Initial setting |
|---|---|
| Counter type | Physical OR Mystic |
| Timing | Controlled |
| Trigger | First qualifying incoming direct attack packet |
| Reflection | 100% of eligible would-be HP damage |
| Damage cap | Lower of 20% attacker Max HP or 25% defender Max HP |
| Defense | Negate qualifying incoming packet |
| Allowed directions | Front and sides |
| Bypass direction | Rear |
| Maximum triggers | 1 per preparation |
| Duration | Until start of user's next turn |
| Attack restriction while primed | All offensive attacks |
| Attack Skill restriction after ending | 1 complete owner turn |
| Cooldown | 3 owner turns |
| Suggested cost | 50 AP + 5 MP |
| Revealed interaction | Disarm and prevent preparation |
| Covert interaction | Use existing Covert mechanics |

These numerical values should be treated as configurable balance defaults, not hardcoded universal constants.

### Physical/Mystic exclusivity

The Master Panel must provide a single-choice selector:

- Physical Reversal
- Mystic Reversal

Selecting one must exclude the other. There must be no Both option, mixed-family selection, or omitted default that implicitly grants both.

Physical Reversal responds only to direct Physical damage packets. Mystic Reversal responds only to direct Mystic damage packets.

The incoming attack's authoritative damage family determines eligibility, including the dynamically resolved family of Basic Attack. Never infer family merely from Skill names, animations, or element.

Validate this restriction in both the Master Panel and server-side content publication.

## 3. Preparation and Controlled Timing

### Preparing Reversal

The owner chooses the Reversal Skill during their normal turn and commits its preparation.

Preparation:

1. Validates available resources, cooldown, status restrictions and usage limits.
2. Requires that the owner has performed no offensive attack during the current turn.
3. Pays the Skill's AP/MP cost immediately.
4. Starts its normal cooldown.
5. Creates one authoritative armed Reversal instance.
6. Records the preparation as a normal Skill use in the battle log.

Preparation must not wait until an incoming attack to charge resources.

Once prepared, the user may still move, Guard, Recover or use eligible non-offensive utility/healing actions with remaining AP. However, no offensive attack may be performed while Reversal remains primed.

The user's final facing is committed normally when ending the turn. That facing determines which attack directions can trigger the counter.

### Preparation visibility

**Reversal has no built-in concealment whatsoever.**

The combat log must announce its preparation using Aurevane's existing Skill names, descriptions, event narration and normal visibility rules.

Example:

> Player A uses Mirror Reversal. Player A prepares to turn an incoming attack against its source.

Do not add special secret activation messages, hidden preparation states, masked Skill names, or artificial uncertainty about Reversal.

The opponent may inspect information normally exposed by the game. If the authored Skill description communicates its Physical/Mystic configuration, that information must not be secretly redacted.

The tactical uncertainty should arise naturally from the combat situation, opponent's build, available counterplay and legitimate Covert effects.

### Covert integration

Covert must interact with Reversal using the existing Covert information and visibility rules.

If a character can legitimately prepare Reversal while Covert is active, its preparation must receive the same visibility treatment as other comparable actions under Covert.

Do not introduce any Reversal-specific stealth system.

Preparing Reversal is a defensive/utility action and should not automatically break Covert merely because the counter may later cause damage. However, once Reversal actually inflicts returned damage, apply the existing appropriate reveal/break-Covert behaviour.

Do not allow preparing Reversal to bypass any existing Covert restrictions.

## 4. Initiative and Active Duration

Reversal must never grant additional Initiative, extra turns, or an opportunity to inspect a committed incoming action and manually choose whether to counter.

It is prepared during the owner's legitimate turn, then automatically triggers when eligible.

### Higher Initiative example

- Player A: Initiative 110.
- Player B: Initiative 90.
- Player A prepares Reversal in round 3.
- Player A ends their turn facing B.
- Player B attacks.
- If the attack qualifies, Reversal activates immediately during that attack's resolution.

### Lower Initiative example

- Player B acts first.
- Player A cannot retroactively counter B's already completed attack.
- Player A prepares Reversal later in round 3.
- Reversal remains available through the round transition until the start of A's next actual turn, unless triggered or removed earlier.

### Duration rule

A prepared Reversal lasts from successful preparation until the earliest of:

- Its first qualifying trigger.
- The start of its owner's next actual turn.
- Successful removal by Reveal.
- Manual cancellation.
- Owner defeat or battle termination.

The window must not expire merely because a global round boundary occurs.

Use authoritative server turn progression, not animation time or browser timers.

This is a specialised armed-counter lifetime, not an uncontrolled reinterpretation of all existing Controlled effects.

## 5. Incoming Attack Resolution

When an opponent commits an attack against a character with armed Reversal, evaluate the following in order:

1. Is Reversal still active and unused?
2. Is the incoming effect hostile and direct damage?
3. Does its actual damage family match the configured Reversal family?
4. Is the attacker's authoritative position in the defender's front or side arc?
5. Does the attack successfully hit?
6. Would the attack cause positive HP damage after normal mitigation, existing defenses and applicable Barrier absorption?
7. Is the original damage packet eligible for a counter, rather than being indirect/reflected/system damage?

If every condition is satisfied, Reversal automatically activates.

### Successful Reversal

- Prevent the qualifying incoming damage packet from damaging the defender.
- Prevent that same intercepted hit's dependent hostile effects against the defender.
- Preserve the normal resolution of unrelated recipients and independent effects.
- Calculate return damage from the damage that would otherwise have reached the defender's HP.
- Return the configured percentage to the original attacker, subject to the damage cap.
- Consume the armed Reversal instance.
- Apply the post-Reversal restriction.
- Record the outcome in the normal combat log.

Use the original attack's committed accuracy and damage outcome. Never perform an extra accuracy roll or resample a critical result merely because Reversal activated.

Reflected damage must not receive an additional critical hit, offensive stat scaling, repeat-use multiplier or recursive reflection. Do not trigger Absorb, Reversal, ordinary Reflect, Vengeance history or other reactive retaliation from this returned damage unless explicitly approved in a separate versioned mechanic.

Existing defenses must be evaluated consistently without actually consuming a Barrier pool if Reversal successfully intercepts the attack.

### Directional counterplay

**Rear attacks always bypass Reversal.**

Front and side attacks may trigger Reversal if their family qualifies.

Use Aurevane's existing positional facing classification. Do not introduce an unrelated direction system.

Determine direction using authoritative attack origin and defender facing at the time the packet resolves.

An attack from behind must remain effective without consuming Reversal. The defender does not automatically rotate to meet it.

If a packet has no trustworthy attack origin, use a documented fail-closed eligibility rule rather than inventing a direction.

### Nonqualifying damage

The following must not consume Reversal:

- Attack from behind.
- Wrong damage family.
- Missed attacks.
- Fully mitigated attacks that would cause no HP damage.
- Periodic Poison, Burn or Bleed damage.
- Environmental damage without an eligible direct attacker.
- Reflected or recursive counter damage.
- Independent non-damage effects.

An opponent may intentionally use a weak qualifying attack to bait and consume the counter.

### Multi-hit and area attacks

Reversal intercepts only one eligible packet.

If a multi-hit Skill has subsequent packets, those packets continue resolving unless the attacker is defeated and ordinary combat rules terminate the action.

For area attacks, Reversal protects only its owner. It must not cancel damage to other recipients or reflect the aggregate damage dealt to the area.

All outcomes must resolve deterministically and be replay-safe.

## 6. Offensive Restrictions

### While Reversal is primed

The user cannot perform offensive attacks.

Block all offensive commands, including Basic Attack, attack-classified Discipline Skills, Essence attacks, equipment attacks, and qualifying offensive automatic effects.

The Reversal return damage itself is an explicit exception; otherwise the counter could never function.

Movement, defensive commands, healing and legitimate utility actions remain permitted according to ordinary AP and targeting rules.

This restriction must be enforced by the server, not only by disabling UI buttons.

### After Reversal ends — Reversal Strain

Introduce an authoritative effect named **Reversal Strain**.

Whenever an armed Reversal ends for any reason, its owner suffers Reversal Strain for their next complete actual turn.

During this turn:

- Attack-classified Skills are unavailable.
- Offensive Discipline Skills are unavailable.
- Offensive Essence, Resonance-derived commands and equipment Skills are unavailable.
- Offensive automatic Skill activations are suppressed.
- The normal inherent Basic Attack remains available as a limited fallback.
- Movement, Guard, Recover, healing and non-offensive utility remain available.

Reversal Strain expires at the end of that complete owner turn.

It must not be shortened by a global round boundary or a changing Initiative order.

Manual cancellation, expiration, successful triggering and Reveal-induced cancellation must all incur this penalty.

Reversal Strain must be visible through normal status and combat information presentation. It is a system-enforced consequence and should not be copyable, stackable, or removable by ordinary generic Cleanse/Dispel unless separately approved.

Do not allow cancel/re-prime sequences to bypass the restriction. No AP/MP refund is issued for cancellation.

## 7. Reveal — Direct Reversal Counterplay

This interaction is a required part of the feature, not optional polish.

Currently, Reveal is primarily connected to Covert. Extend its eligibility and resolution so that **an armed Reversal is independently a valid reason for Reveal to succeed**, even if the target does not have Covert.

### When Reveal successfully affects an armed Reversal

1. Remove/consume the armed Reversal immediately when the Reveal effect actually resolves.
2. Prevent that Reversal from reflecting the Reveal action's eligible effects once it has been disarmed.
3. Apply the existing Revealed status using its approved timing and duration mechanics.
4. Start Reversal Strain for the defender's next complete owner turn.
5. Preserve the already-paid Reversal cost and cooldown.
6. Record both Reveal and Reversal's removal in the normal combat log.

Reversal cannot be newly prepared while its owner has an **active Revealed** status.

A pending Revealed status must not be treated as active prematurely. Respect the existing tag timing policy. If Reveal is configured as Delayed, it must not disarm Reversal before its effect actually resolves.

### Reveal eligibility and compatibility

A successful Reveal may act on a target who has:

- Covert.
- An armed Reversal.
- Both Covert and an armed Reversal.

If both exist, Resolve Reveal's existing Covert-clearing behaviour and the new Reversal removal together, without double-applying Revealed or accidentally double-triggering Strain.

Against a target with neither Covert nor armed Reversal, preserve existing Reveal legality and outcome unless a separately documented rule already applies.

Maintain normal accuracy, targeting, line-of-sight, status, timing and resource rules. Do not make Reveal automatically successful or globally unblockable.

Preserve existing Reveal AP modifiers and its other approved interactions.

**Important:** The ability to disarm Reversal must operate on its authoritative armed record. Do not depend solely on generic positive-status removal if that would leave the actual Controlled prime intact.

## 8. Master Panel Implementation

Integrate Reversal into the existing compact Tag authoring workflow rather than creating a separate page.

Required fields:

- Reversal family: Physical / Mystic (one only).
- Reflection damage percentage.
- Return damage cap.
- Trigger count (default one).
- Allowed facing arcs.
- Armed duration policy.
- Post-Reversal attack restriction.
- Reversal cooldown and costs through existing Skill-level authoring.
- Concise help text explaining Controlled preparation, Reveal interaction and counterplay.

Use existing shared timing controls. Reversal's preparation must use Controlled, while actual interception occurs at a deterministic server pre-damage reaction point.

The Master Panel must reject unsupported combinations, particularly Reversal plus simultaneously authored offensive damage in the same preparation action, unrestricted multi-counter stacking, or a Physical-and-Mystic selection.

Display the actual authored Reversal behaviour in Skill descriptions, reports, previews and Master Panel readers.

Do not alter unrelated Tag timing defaults, other Controlled Skills, or historical Skill definitions.

## 9. Combat Engine Implementation

Implement a dedicated, versioned Reversal effect handler.

Existing relevant source areas include:

- `packages/game-core/src/combat/combat-tag-registry.ts`
- `packages/game-core/src/combat/combat-effect-timing.ts`
- `packages/game-core/src/combat/combat-controlled.ts`
- `packages/game-core/src/combat/combat-ability-command.ts`
- `packages/game-core/src/combat/combat-ability-events.ts`
- `packages/game-core/src/combat/combat-kernel-types.ts`
- `packages/game-core/src/combat/combat-reflect.ts`
- `packages/game-core/src/combat/covert-sensory-revealed.ts`
- `packages/game-core/src/combat/combat-requirements.ts`
- `packages/game-core/src/combat/battle-state.ts`

These are starting points, not an exhaustive or mandatory file-change list.

Current Controlled priming is a free manual preparation operation. Reversal needs a deliberately paid, time-limited armed preparation with automatic interception. Extend or specialise the existing framework safely; **do not change all Controlled abilities into paid or automatic counter abilities.**

The existing Reflect implementation reacts to committed damage after damage has occurred. Reversal instead requires interception before the incoming packet mutates HP. Reuse shared safe primitives where appropriate, but do not try to achieve cancellation through post-damage healing or state rollback.

Add versioned battle policy/captured-definition support as needed to protect replay determinism and prevent changes to already-running or historical battles.

Use the existing reaction budget, trigger-chain guard and deterministic packet ordering. Prevent recursive counter loops, duplicate outcomes, lost turn authority or repeated costs following retries/reconnects.

Retain the game's authoritative current-turn, AP, MP, Initiative and cooldown semantics.

## 10. Combat Presentation and Logs

Use the normal Chronicle/battle log and Skill descriptions.

Expected examples:

**Preparation**

> A uses Mirror Reversal and prepares a counterattack.

**Successful reflection**

> B's Mystic attack is reversed! A avoids 42 damage and returns 42 damage to B.

**Wrong attack family**

> B's attack hits A normally.

Do not reveal private Reversal state through an unnecessary failure message.

**Attack from behind**

> B strikes A from behind, bypassing the prepared counter.

**Reveal**

> B uses Reveal. A's Mirror Reversal is disrupted, and A becomes Revealed.

**Expiration**

> A's Mirror Reversal expires without activating. A suffers Reversal Strain.

**Restricted action**

> Attack Skills are unavailable during Reversal Strain.

These are illustrative messages. Integrate with Aurevane's established terminology, event formatting, source visibility and Chronicle presentation rather than hardcoding a parallel narrative system.

The normal Reversal preparation should be visible to both sides unless existing Covert rules legitimately limit visibility.

The player who owns Reversal must be able to see their current prepared state, valid restrictions, expiry and Strain state.

## 11. Acceptance Tests

Implement automated coverage and appropriate end-to-end acceptance checks for:

1. Physical Reversal counters Physical but not Mystic damage.
2. Mystic Reversal counters Mystic but not Physical damage.
3. Authoring cannot select both families.
4. Preparation pays AP/MP exactly once and starts cooldown.
5. Preparation is rejected after an attack during the same turn.
6. Offensive commands fail while armed, including automatic attacks.
7. Defensive, movement and utility actions remain legal.
8. Higher and lower Initiative cases behave correctly.
9. An armed counter survives a global round boundary but expires at the owner's next turn.
10. Front and side attacks qualify; rear attacks bypass.
11. Wrong-family attacks, misses and fully absorbed hits do not consume Reversal.
12. A weak eligible hit can bait and consume Reversal.
13. Multi-hit and area attacks do not produce multiple or aggregate counter returns.
14. Reflected damage obeys its cap and cannot trigger another counter.
15. Reversal ends safely if the attacker or defender is defeated.
16. Reversal Strain restricts Attack Skills for exactly one complete owner turn.
17. Basic Attack remains available during Strain.
18. Manual cancellation cannot refund costs or bypass Strain.
19. Normal preparation appears in the opponent's battle log.
20. Covert uses established visibility behaviour without custom concealment.
21. Reveal successfully removes Reversal with or without Covert.
22. Active Revealed prevents new Reversal preparation.
23. Pending Revealed does not apply restrictions prematurely.
24. Existing Reveal/Covert behaviour remains unchanged outside the new interaction.
25. Existing Controlled, Reflect and ordinary Attack Skills remain compatible.
26. No duplicate reaction, cost, damage or event occurs on retry or reconnect.
27. Both PvP and AI use the same authoritative rules.
28. AI makes decisions only from information available under its legitimate visibility rules.
29. Master Panel configuration saves, persists, publishes and survives refresh.
30. Historical battle snapshots preserve their captured mechanics.
31. Desktop and mobile combat readers display the new Tag and restrictions clearly.
32. Complete battle logs, replay and spectator views remain consistent.

## 12. Release and Delivery

Implement the complete feature in a scoped, reviewable branch/PR.

Follow Aurevane's existing engineering, testing, content-publication, compatibility and deployment requirements.

Perform comprehensive unit, integration and relevant browser tests. Do not weaken unrelated test expectations.

Verify the latest repository state and reconcile against any ongoing Master Panel or combat changes before editing.

Do not silently publish or modify existing Discipline Skills. Register the new Reversal Tag and make it available for future authored Skills.

Once implementation and tests pass, follow the project's established release gates to make the feature available for testing.

Provide a final report identifying:

- Files and systems changed.
- Exact Reversal and Reveal behaviour implemented.
- Any technical deviations from this specification and their rationale.
- Tests executed and their outcomes.
- PR and deployment status.
- Whether the new Tag is confirmed available in the live Master Panel.

**Completion criterion:** An owner can author either a Physical or Mystic Reversal through the Master Panel, publish it, and have it work consistently in actual combat with visible preparation, directional counterplay, Initiative-aware duration, offensive restrictions, Covert compatibility and Reveal disruption.
