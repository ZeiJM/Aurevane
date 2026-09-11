# Phase 4 — human playtest packet

Status: ready to run; no human results have been recorded by this packet.

Use the live sixteen-Discipline roster. Keep the same character attributes, four selected regular Skills, build version and arena within each comparison. Record Primary/Secondary, Essence or Resonance, selected Skills, map, opponent, difficulty, device, battle ID and any timeout. Swap sides and repeat before drawing a balance conclusion. Existing testing Mastery grants make the roster available; do not remove production grants to simulate acquisition.

## Session 1 — effect clarity and cost

| Comparison | Exercise | Evidence to record |
| --- | --- | --- |
| Bastion / Ravager | Use Fortress and Frenzy in separate pure builds. Compare damage before, during and after Fortified/Reckless. | Can the player explain both benefit and drawback without reading the code? Was there a meaningful reason to delay activation? |
| Wildwarden | Mark one enemy, then attack that enemy with the source and another ally in a multi-combatant battle. | Does Marked clearly identify whose damage is amplified? Record both previews and log entries. |
| Bastion | Challenge an enemy in a multi-combatant battle; compare its attack against the challenger and another ally. | Is the source exception understandable? Can the opponent make a useful choice? |
| Cinderweaver | Apply Burn and Ash Ward. Compare damage received from burning and unburned enemies. | Does Warded communicate its condition accurately? |
| Dawnshield / Tidecaller | Cleanse a harmful status, then inspect a linked tradeoff separately. | Are removable statuses clear? Does either side of a tradeoff ever remain alone? |
| Frostweaver / Wildwarden | Compare Slow and Root, then use attacks/facing while movement is restricted. | Can the player distinguish extra movement cost from prohibited movement? |

For numerical comparisons, preserve armor/ward, attack direction, distance, target identity, status stacks and repeat-use state. Consecutive use of the same ordinary Skill has 50% effectiveness at unchanged AP/MP; alternate Skills when measuring baseline output. A miss is not a zero-damage successful hit. Record the actual pre-commit forecast and committed outcome separately.

## Session 2 — identity and counterplay

| Pure build | Opposing pressure | Question |
| --- | --- | --- |
| Bastion | Ravager | Is protecting a target worth the lost personal pressure? |
| Edgedancer | Bastion | Can movement/facing create useful openings without making defense irrelevant? |
| Wildwarden | Tidecaller | Does snare/attrition pressure allow recovery or positioning counterplay? |
| Runeblade | Dawnshield | Does physical/mystic choice matter against different defenses? |
| Cinderweaver | Frostweaver | Do Burn pressure and movement denial create different decisions? |
| Stormsinger | Tidecaller | Can lane pressure/resource disruption be answered through positioning and recovery? |

Run each comparison on Crossroads Court, then Terraced Yard. Try Standard AI for initial learning and High AI for pressure. Use player-versus-player sessions for human counterplay conclusions. AI correctness tests do not establish human matchup balance. Stop a matchup if a reproducible legality or UI defect prevents fair play and retain its battle ID.

## Session 3 — pure versus mixed builds

For each of the six pairings above, try both Primary directions with the same four-Skill split, then compare a pure build. Check that the mixed build has Resonance and no Essence; the pure build has Essence and no Resonance. Record the actual sequence that activates the pair and whether the payoff changes a tactical choice. Include at least one 1+3, 2+2 and 3+1 selection across the session. Do not describe a pair as validated solely because its trigger fired.

## Session 4 — media review

Open the standalone `phase4-media-review.html` packet. The pack contains ten identity illustrations and 72 original synthesized material cues. These are review candidates, not approved recordings or 80 bespoke Skill paintings.

1. Compare artwork at 32, 64 and 128 px. Check shield versus sun-shield, sabre versus rune-sword, and ice versus water versus lightning.
2. Listen at comfortable volume on headphones and ordinary speakers. Compare all three regular and Essence variations. Check that an Essence gains character without a loudness jump.
3. Try two overlapping cues, Mute, zero Master/SFX volume and Stop audio. Leave the tab while playing. Sound should stop and should not resume from old history.
4. Record any piercing, synthetic, muddy or indistinguishable sound. Material synthesis is an original source method; it is not evidence that a cue passes listening review.
5. Save review notes. Notes are a review draft; they do not publish assets or grant approval by themselves.

## Feedback record

Use `content/balance/phase4-playtest-results-template.csv`. One row per actual exercise. Leave untested fields blank. Include whether the player understood the effect, had a counterplay option, changed a decision, wanted to try another build, and any accessibility problem. Keep screenshots/log evidence linked to the battle ID. Do not fill results from simulations or generated personas.

## Acceptance decision

Separate reproducible defects, tuning suggestions, media revisions and preference. Repair legality/readability defects first. Keep an unchanged baseline when testing a proposed balance adjustment. The Owner records the final acceptance decision after reviewing actual sessions; this document does not manufacture that decision or an independent tester count.
