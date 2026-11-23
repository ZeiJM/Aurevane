# Current targeting catalog audit

Read-only inventory of built-in current definitions on tree `42463a77d117594d08920399b35ac82742876bb9`, released through PR #844 as `ba39fe0e07c9274ebc05cc8edaec48ed84d049e5`. This is planning evidence, not a content migration.

Totals: 117 Single, 23 Circle and 13 Line definitions across 136 Discipline Skills and 17 Essences. All 36 current area definitions use affected-unit recipients for their external unit effects; no audited area definition has a target-specific requirement. Independent actor effects remain separately authored.

Every Circle changes from a remote Euclidean footprint to caster-centered Chebyshev coverage. Every Line changes from a selected endpoint to full authored cardinal length. New immutable versions preserve all unrelated fields. Single definitions keep existing behavior. No built-in All definition is invented.

| Current ID                          | Version | Shape      | Prior range | Target / policy                    | LoS          | Elevation |
| ----------------------------------- | ------- | ---------- | ----------- | ---------------------------------- | ------------ | --------- |
| vanguard.cleave                     | 4       | Circle [1] | 1–1         | unit / enemy / enemies-only        | Not required | 0         |
| vanguard.sweeping-strike            | 4       | Circle [1] | 1–1         | unit / enemy / enemies-only        | Not required | 0         |
| lifebinder.sanctuary                | 4       | Circle [1] | 1–3         | unit / ally / allies-only          | Required     | 0         |
| lifebinder.searing-bloom            | 5       | Circle [1] | 1–3         | unit / enemy / enemies-only        | Required     | 0         |
| aetherist.mana-burst                | 5       | Circle [1] | 1–3         | unit / enemy / enemies-only        | Required     | 0         |
| aetherist.arcane-field              | 5       | Circle [1] | 1–3         | unit / enemy / enemies-only        | Required     | 0         |
| aetherist.chain-spark               | 5       | Line [3]   | 1–4         | unit / enemy / enemies-only        | Required     | 1         |
| farstrider.volley                   | 4       | Circle [1] | 2–5         | unit / enemy / enemies-only        | Required     | 1         |
| farstrider.piercing-barrage         | 4       | Line [4]   | 2–5         | unit / enemy / enemies-only        | Required     | 0         |
| shadehand.fan-of-knives             | 4       | Circle [1] | 1–1         | unit / enemy / enemies-only        | Not required | 0         |
| ironfist.sweep                      | 4       | Circle [1] | 1–1         | unit / enemy / enemies-only        | Not required | 0         |
| bastion.shield-line                 | 4       | Line [3]   | 1–3         | unit / enemy / enemies-only        | Not required | 0         |
| ravager.cleaving-blow               | 4       | Circle [1] | 1–1         | unit / enemy / enemies-only        | Not required | 0         |
| ravager.war-roar                    | 4       | Circle [1] | 1–1         | unit / enemy / enemies-only        | Not required | 0         |
| edgedancer.severing-cut             | 4       | Line [2]   | 1–2         | unit / enemy / enemies-only        | Not required | 0         |
| wildwarden.venom-shot               | 4       | Circle [1] | 2–5         | ground-tile / enemy / enemies-only | Required     | 0         |
| wildwarden.thorn-line               | 4       | Line [3]   | 1–3         | unit / enemy / enemies-only        | Required     | 0         |
| runeblade.arc-edge                  | 4       | Line [2]   | 1–2         | unit / enemy / enemies-only        | Not required | 0         |
| dawnshield.consecrated-light        | 4       | Circle [1] | 0–3         | unit / ally / allies-only          | Required     | 0         |
| dawnshield.aegis                    | 4       | Circle [1] | 0–3         | unit / ally / allies-only          | Required     | 0         |
| cinderweaver.flame-burst            | 5       | Circle [1] | 1–4         | ground-tile / enemy / enemies-only | Required     | 0         |
| cinderweaver.ember-line             | 5       | Line [3]   | 1–3         | unit / enemy / enemies-only        | Required     | 0         |
| frostweaver.chilling-mist           | 5       | Circle [1] | 1–4         | ground-tile / enemy / enemies-only | Required     | 0         |
| frostweaver.ice-line                | 4       | Line [3]   | 1–3         | unit / enemy / enemies-only        | Required     | 0         |
| stormsinger.lightning-line          | 4       | Line [4]   | 2–4         | unit / enemy / enemies-only        | Required     | 2         |
| stormsinger.static-burst            | 5       | Circle [1] | 1–4         | unit / enemy / enemies-only        | Required     | 0         |
| tidecaller.cleansing-rain           | 4       | Circle [1] | 0–3         | unit / ally / allies-only          | Required     | 0         |
| tidecaller.flood-line               | 5       | Line [3]   | 1–3         | unit / enemy / enemies-only        | Required     | 0         |
| essence.aetherist.aether-nova       | 5       | Circle [2] | 1–3         | unit / enemy / enemies-only        | Required     | 1         |
| essence.farstrider.deadeye-barrage  | 4       | Line [5]   | 2–5         | unit / enemy / enemies-only        | Required     | 2         |
| essence.ravager.red-tempest         | 4       | Circle [1] | 1–1         | unit / enemy / enemies-only        | Not required | 0         |
| essence.runeblade.runic-overdrive   | 4       | Line [3]   | 1–3         | unit / enemy / enemies-only        | Not required | 0         |
| essence.cinderweaver.phoenix-wake   | 4       | Circle [2] | 1–4         | unit / enemy / enemies-only        | Required     | 1         |
| essence.frostweaver.absolute-winter | 4       | Circle [1] | 1–4         | unit / enemy / enemies-only        | Required     | 0         |
| essence.stormsinger.skybreak        | 4       | Line [5]   | 1–5         | unit / enemy / enemies-only        | Required     | 1         |
| essence.tidecaller.tidal-crown      | 4       | Circle [1] | 0–3         | unit / ally / allies-only          | Required     | 0         |

Production publication preflight for the preceding release found the combat-content version table empty. Reinspect published Skill/Essence definitions before implementation and again before release; built-in inventory does not authorize overwriting future Owner publications.

Owner follow-up (2026-10-06, 20:58 Trinidad): full potential targeting glows must persist when a combatant is detected. The two supplied images show full four-way lanes without a target and only the right-hand segment after Recruit is detected. An automatic forecast must not be treated as an explicit player aim.
