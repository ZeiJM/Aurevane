# Phase 4 — human playtest packet

Status: ready to run; no human results have been recorded by this packet.

Use the seventeen-Discipline roster. Run the gameplay-interaction exercises below after its continuation release is verified in `PHASE_4_TICKETS.md`; earlier frozen battles retain their earlier Skill definitions. Keep the same character attributes, four selected regular Skills, build version and arena within each comparison. Record Primary/Secondary, Essence or Resonance, selected Skills, map, opponent, difficulty, device, battle ID and any timeout. Swap sides and repeat before drawing a balance conclusion. Existing server-owned testing access makes the published roster available independently of earned Mastery; preserve that policy when testing acquisition.

## Session 1 — effect clarity and cost

| Comparison               | Exercise                                                                                                                    | Evidence to record                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Bastion / Ravager        | Use Fortress and Frenzy in separate pure builds. Compare damage before, during and after Fortified/Reckless.                | Can the player explain both benefit and drawback without reading the code? Was there a meaningful reason to delay activation? |
| Wildwarden               | Mark one enemy, then attack that enemy with the source and another ally in a multi-combatant battle.                        | Does Marked clearly identify whose damage is amplified? Record both previews and log entries.                                 |
| Bastion                  | Challenge an enemy in a multi-combatant battle; compare its attack against the challenger and another ally.                 | Is the source exception understandable? Can the opponent make a useful choice?                                                |
| Cinderweaver             | Apply Burn and Ash Ward. Compare damage received from burning and unburned enemies.                                         | Does Warded communicate its condition accurately?                                                                             |
| Dawnshield / Tidecaller  | Cleanse a harmful status, then inspect a linked tradeoff separately.                                                        | Are removable statuses clear? Does either side of a tradeoff ever remain alone?                                               |
| Chronist                 | Prepare Haste/Delay, complete the round and compare the next order. Move then Rewind Step; try Root and an occupied origin. | Does next-round timing remain clear, and is the lack of AP/movement refunds visible?                                          |
| Frostweaver / Wildwarden | Compare Slow and Root, then use attacks/facing while movement is restricted.                                                | Can the player distinguish extra movement cost from prohibited movement?                                                      |

For numerical comparisons, preserve armor/ward, attack direction, distance, target identity, status stacks and repeat-use state. Consecutive use of the same ordinary Skill has 50% effectiveness at unchanged AP/MP; alternate Skills when measuring baseline output. A miss is not a zero-damage successful hit. Record the actual pre-commit forecast and committed outcome separately.

## Session 2 — identity and counterplay

| Pure build   | Opposing pressure | Question                                                                                      |
| ------------ | ----------------- | --------------------------------------------------------------------------------------------- |
| Chronist     | Ironfist          | Can next-round preparation and positional return answer close pressure without denying turns? |
| Bastion      | Ravager           | Is protecting a target worth the lost personal pressure?                                      |
| Edgedancer   | Bastion           | Can movement/facing create useful openings without making defense irrelevant?                 |
| Wildwarden   | Tidecaller        | Does snare/attrition pressure allow recovery or positioning counterplay?                      |
| Runeblade    | Dawnshield        | Does physical/mystic choice matter against different defenses?                                |
| Cinderweaver | Frostweaver       | Do Burn pressure and movement denial create different decisions?                              |
| Stormsinger  | Tidecaller        | Can lane pressure/resource disruption be answered through positioning and recovery?           |

Run each comparison on Crossroads Court, then Terraced Yard. Try Standard AI for initial learning and High AI for pressure. Use player-versus-player sessions for human counterplay conclusions. AI correctness tests do not establish human matchup balance. Stop a matchup if a reproducible legality or UI defect prevents fair play and retain its battle ID.

## Session 3 — pure versus mixed builds

For each of the pairings above, try both Primary directions with the same four-Skill split, then compare a pure build. Check that the mixed build has Resonance and no Essence; the pure build has Essence and no Resonance. Record the actual sequence that activates the pair and whether the payoff changes a tactical choice. Include at least one 1+3, 2+2 and 3+1 selection across the session. Do not describe a pair as validated solely because its trigger fired.

## Session 4 — media review

Open the standalone `phase4-media-review.html` packet. The original pack contains ten identity illustrations and 72 original synthesized material cues. Include the Ironfist and Chronist follow-up paintings and six cues each using their release manifests. These are review candidates, not approved recordings or 80 bespoke Skill paintings.

1. Compare artwork at 32, 64 and 128 px. Check shield versus sun-shield, sabre versus rune-sword, and ice versus water versus lightning.
2. Listen at comfortable volume on headphones and ordinary speakers. Compare all three regular and Essence variations. Check that an Essence gains character without a loudness jump.
3. Try two overlapping cues, Mute, zero Master/SFX volume and Stop audio. Leave the tab while playing. Sound should stop and should not resume from old history.
4. Record any piercing, synthetic, muddy or indistinguishable sound. Material synthesis is an original source method; it is not evidence that a cue passes listening review.
5. Save review notes. Notes are a review draft; they do not publish assets or grant approval by themselves.

## Session 5 — gameplay tags and ground targeting

These exercises cover the new versioned interactions. Use new battles after activation. Inspect the Skill's current details before selecting it, record its preview before confirmation, and compare the committed result. Include phone, keyboard and a spectated PvP session across the exercises.

| Setup                      | Exercise                                                                                                                                 | Evidence to record                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tidecaller / Stormsinger   | Apply Water Lance, then Arc Spark to the Wet target. Separately prepare Conductive with Static Drain and use Conductive Bolt.            | Wet/Conductive requirements, one bounded storm bonus per recipient per command, consumed Conductive and retained Wet are understandable.                                               |
| Frostweaver / Cinderweaver | Target empty ground with Chilling Mist, then use Flame Burst over Frozen terrain.                                                        | The chosen empty tile previews legally; confirmation spends resources once; Frozen becomes Steam. Record affected tiles, both-team terrain policy, duration, line of sight and reload. |
| Frostweaver / Ironfist     | Compare movement into Frozen terrain before and after Breakfall, and separately with Slow or Root.                                       | The highlight and forecast agree with AP and Movement spent. Airborne removes only the Frozen surcharge; base terrain, Slow and Root remain readable.                                  |
| Frostweaver                | Apply Frozen with Ice Lance, then use Shatter. Compare a target without Frozen.                                                          | The payoff requirement explains why one target is legal and the other is not.                                                                                                          |
| Wildwarden / Runeblade     | Apply Renewing Herbs, then inspect spirit protection; use Aether Cut to dispel it. Apply Sigil Brand before healing the affected target. | Summoned protection, its removal and Hexed's healing reduction are clear, including remaining duration.                                                                                |
| Shadehand                  | Use Smoke Vial. Compare hostile direct selection with a ground/area attack, then attack from concealment.                                | The player understands what Invisible blocks and when it breaks. Compare the forecast and log.                                                                                         |
| Ironfist                   | Use Pressure Palm with a clear destination, then against a target whose destination is blocked, occupied or resisted by Root.            | Successful push and Displaced are visible. Failed displacement retains the authored action's resource cost and does not overlap or move the target.                                    |
| Mixed elemental build      | Arm a primary-unit Resonance payoff, use a ground Skill, then a legal unit-targeted attack.                                              | The ground cast preserves the setup; help explains the unit-targeted payoff, and the later attack consumes it once.                                                                    |

Previews must remain silent and spend no AP/MP. Terrain feedback should remain understandable without color alone. Record a defect if the forecast, board, log, inspection or spectator view disagree about the same committed state.

## Session 6 — Discipline Atlas and earned Mastery

1. Open Profile → Discipline Management → Discipline Atlas & Mastery. Use search/filter controls, inspect a published card and a planned card, and close/reopen the popup with keyboard and touch. Check readable prerequisites, no clipped content and sensible focus return.
2. Confirm the roster summary distinguishes 36 designed identities from 17 published Disciplines. Published testing access remains separate from earned XP and normal release eligibility. Planned Mastery Rites should read as future content; hidden identities should stay masked according to reveal policy.
3. Follow the Mastery guidance into a Standard or High Mastery Trial. Win without a timeout after using two different regular Primary Skills across at least three Primary Skill commands. Claim the awarded XP once (up to 50); reload and retry without a second reward. Record the actual battle and claim result. Ordinary sparring should grant no Mastery XP.
4. Open the public Discipline Atlas in the Manual on phone and desktop. Compare names, publication labels, artwork and Mastery explanation with the Profile. Public reading must not reveal secret solutions.

## Feedback record

Use `content/balance/phase4-playtest-results-template.csv`. One row per actual exercise. Leave untested fields blank. Include whether the player understood the effect, had a counterplay option, changed a decision, wanted to try another build, and any accessibility problem. Keep screenshots/log evidence linked to the battle ID. Do not fill results from simulations or generated personas.

## Acceptance decision

Separate reproducible defects, tuning suggestions, media revisions and preference. Repair legality/readability defects first. Keep an unchanged baseline when testing a proposed balance adjustment. The Owner records the final acceptance decision after reviewing actual sessions; this document does not manufacture that decision or an independent tester count.
