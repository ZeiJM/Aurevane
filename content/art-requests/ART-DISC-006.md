# ART-DISC-006 — Regular Discipline Skill action art, batches 01–16

Status: Owner-approved for implementation and production deployment after direct visual review in ChatGPT. The complete 136-image regular Discipline Skill replacement program is approved across all 17 Disciplines.

Scope: all 136 regular Skill illustrations in the Discipline Skill replacement program:
- Vanguard: all 8 current regular Skills.
- Farstrider: all 8 current regular Skills.
- Shadehand: all 8 current regular Skills.
- Lifebinder: all 8 current regular Skills.
- Ironfist: all 8 current regular Skills.
- Aetherist: all 8 current regular Skills.
- Chronist: all 8 current regular Skills.
- Bastion: all 8 current regular Skills (Shield Bash, Cover, Challenge, Fortress, Hold Fast, Shield Line, Stalwart Strike and Steady Footing).
- Ravager: all 8 current regular Skills (Frenzy, Gash, Cleaving Blow, Blood Rush, War Roar, Desperate Execution, Blood Siphon and Open Wound).
- Edgedancer: all 8 current regular Skills (Lunge, Riposte, Hamstring, Flourish, Poised Guard, Flanking Cut, Severing Cut and Finishing Thrust).
- Wildwarden: all 8 current regular Skills (Snare, Hunter's Mark, Venom Shot, Field Remedy, Thorn Line, Pursuit Shot, Renewing Herbs and Close Quarry).
- Runeblade: all 8 current regular Skills (Arc Edge, Rune Guard, Siphon Slash, Sigil Brand, Rune Burst, Unbinding Rune, Aether Cut and Rune Mending).
- Dawnshield: all 8 current regular Skills (Radiant Strike, Sacred Guard, Purge, Consecrated Light, Aegis, Renewal, Judgment and Last Light).
- Cinderweaver: all 8 current regular Skills (Cinder Bolt, Flame Burst, Ember Line, Scorch, Ash Ward, Flashfire, Banked Embers and Blistering Heat).
- Frostweaver: all 8 current regular Skills (Ice Lance, Frost Guard, Chilling Mist, Crystal Prison, Shatter, Ice Line, Thaw and Brittle Ice).
- Stormsinger: all 8 current regular Skills (Arc Spark, Lightning Line, Static Burst, Thunderclap, Grounding, Static Drain, Conductive Bolt and Storm Breath).
- Tidecaller: all 8 current regular Skills (Water Lance, Mist Veil, Undertow, Cleansing Rain, Flood Line, Springwater, Still Water and Crushing Wave).

The earlier rejected fourth-generation attempt is not used. Vital Sever, Searing Bloom and all eight Ironfist illustrations come from the later clean, individually generated 1:1 Run 4 accepted by the Owner. Batch 05 adds Aetherist, Batch 06 adds Chronist, and Batch 07 adds Bastion as complete Discipline sets using canonical published Skill IDs.

Bastion v02 refresh: after testing the first Bastion release, the Owner reported that Hold Fast did not present an image in the intended experience and that several Bastion compositions looked too repetitive/carbon-copy. The Owner requested and approved a full eight-image Bastion refresh in the stronger moonlit-gold Bastion visual language. All eight canonical Bastion Skill IDs now point to cache-busting `-v02.webp` runtime derivatives. The earlier Bastion grids/collages, duplicate attempts and v01 runtime mappings are not used by the registry.

Ravager batch: eight separate 1:1 illustrations were approved after an extra distinction pass so each Skill reads as a different action composition while retaining one crimson/black iron berserker identity.

Edgedancer batch: eight separate 1:1 illustrations were approved as a complete Discipline set, using a moonlit blue-black duelist identity with distinct lunging, countering, control, flourish, guard, flanking, severing and finishing compositions.

Wildwarden batch: eight separate 1:1 illustrations were approved as a complete Discipline set, using a dark verdant hooded warden identity with strongly distinct thorn restraint, quarry marking, venom archery, field remedy, thorn-line control, pursuit shot, renewing herbs and close-quarters strike compositions.

Runeblade batch: eight separate 1:1 illustrations were approved as a complete Discipline set, using a silver-black armored spellsword identity with blue-violet runic energy and distinct crescent edge, guarded stance, siphoning slash, sigil brand, ranged rune burst, chain-breaking unbinding, aether cut and restorative rune-mending compositions.

Dawnshield batch: eight separate 1:1 illustrations were approved as a complete white-gold holy guardian set with distinct radiant offense, ally protection, cleansing, consecration, aegis, renewal, judgment and last-light compositions.

Cinderweaver batch: eight separate 1:1 illustrations were approved as a complete ember-red fire caster set with distinct bolt, burst, line, scorch, ward, close-range flashfire, ember recovery and heat-control compositions.

Frostweaver batch: eight separate 1:1 illustrations were approved as a complete blue-white ice caster set with distinct lance, guard, chilling field, prison, shatter, ice-line, thaw and brittle-ice compositions.

Stormsinger batch: eight separate 1:1 illustrations were approved as a complete moonlit lightning-and-wind caster set with distinct spark, lightning line, static burst, thunderclap, grounding, drain, conductive payoff and storm-breath compositions.

Tidecaller batch: eight separate 1:1 illustrations were approved as a complete teal-and-white oceanic caster set with distinct water lance, mist defense, undertow, cleansing rain, flood line, springwater, still-water recovery and crushing-wave compositions.

Visual direction: one standalone square image per Skill; premium dark-fantasy anime RPG action illustration; no grids, collages, panels, embedded text, logos, borders, watermarks or procedural template filler. Generated imagery is presentation-only.

Source method: generated in the Owner's 2026-09-23 ChatGPT art-review session with OpenAI image generation. The accepted Discipline batches cover all 136 regular Skills. Runtime derivatives are optimized 128×128 WebP encodes under `apps/web/public/media/art/discipline-skills/`; Bastion uses v02 paths so stale v01 CDN/browser caches cannot mask the refresh.

Stable integration: canonical regular Skill IDs and their existing `media.iconKey` hooks remain the source identifiers. `apps/web/src/media/regular-skill-art.ts` maps exactly all 136 approved current regular Skill IDs. No current regular Discipline Skill remains on the generated fallback.

Replacement policy: future approved art can replace/version these runtime paths without changing gameplay authority. Artwork does not affect combat rules, AP/MP, targeting, accuracy, AI, version pinning, persistence, progression or database state.
