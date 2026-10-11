# Percentage DoT balance measurement

Pre-release implementation evidence. The approved nine percentages are unchanged; these automated measurements are not human playtest acceptance.

Legal Level100 offensive full-pool allocations; four current Skills; same-build mirrors with Basic Attack fallback; seeded accuracy, crit, resistance, AP and cooldowns. Skill rows include all scheduled ticks against one or two recipients; no movement bonus, healing, reactive buffs or human playtest.

The pre-release read-only Production check found zero current Skill/Essence database publications. No database conversion, write or migration was needed.

| Discipline | Selected Skills | Seeds | Mean rounds | Min–max |
| --- | --- | ---: | ---: | --- |
| ravager | ravager.gash, ravager.cleaving-blow, ravager.blood-siphon, ravager.frenzy | 30 | 4.87 | 4–6 |
| edgedancer | edgedancer.severing-cut, edgedancer.lunge, edgedancer.hamstring, edgedancer.flourish | 30 | 2.00 | 2–2 |
| wildwarden | wildwarden.venom-shot, wildwarden.thorn-line, wildwarden.close-quarry, wildwarden.snare | 30 | 2.80 | 2–3 |
| cinderweaver | cinderweaver.cinder-bolt, cinderweaver.flame-burst, cinderweaver.ember-line, cinderweaver.blistering-heat | 30 | 2.00 | 2–2 |

| Skill | AP | Cooldown | Mean direct HP | Mean periodic HP | Total HP / 100 AP | Resisted recipients / 20 casts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ravager.gash | 45 | 2 | 39.25 | 23.25 | 138.89 | 0 |
| edgedancer.severing-cut | 45 | 2 | 69.60 | 27.15 | 215.00 | 0 |
| wildwarden.venom-shot | 50 | 3 | 71.60 | 34.80 | 212.80 | 1 |
| cinderweaver.cinder-bolt | 45 | 2 | 37.00 | 20.50 | 127.78 | 0 |
| cinderweaver.flame-burst | 50 | 3 | 75.95 | 28.70 | 209.30 | 5 |
| cinderweaver.ember-line | 45 | 2 | 68.80 | 26.45 | 211.67 | 2 |
| cinderweaver.blistering-heat | 50 | 2 | 37.00 | 9.25 | 92.50 | 0 |
| essence.ravager.red-tempest | 65 | 3 | 102.05 | 59.25 | 248.15 | 0 |
| essence.cinderweaver.phoenix-wake | 65 | 3 | 100.05 | 56.90 | 241.46 | 0 |

Every three-HP recipient overkill case produced zero periodic HP damage. Each row measures its own committed HP receipts and actual scheduled ticks, including misses and resistance. Area rows total all affected enemies and therefore are not single-target efficiency comparisons.

The mirror strategy evaluates selected Skills in a fixed order, honors requirements/AP/cooldowns, and uses Basic Attack as the fallback. This comparison does not rank optimal builds, include movement-triggered Poison, or justify changing the approved percentages. Burn/Poison replacement limits sustained overlap; independent Bleed can accumulate. The low-HP cases exercise defeated-recipient suppression rather than tick rounding, which has separate arithmetic regressions.
