# Owner auxiliary Skill editor clarification

Owner instruction, 2026-10-10, clarified at 13:14 America/Port_of_Spain:

> no I mean that last slot (which is currently used for all those auxillary skills like hp heal, mp heal, and defense) ... allow me to edit all those skills in the panel too

The supplied cockpit screenshot shows Inspect, Move, Basic Attack and MP Recovery in slot 3. The request concerns editing the individual Skill definitions available behind that final Support Action slot. The current authoritative `SUPPORT_ACTION_IDS` in `packages/game-core/src/combat/support-actions.ts` are:

| Existing command identity | Current Skill name | Required panel workflow |
| --- | --- | --- |
| `basic.guard` | Guard (the defense auxiliary) | Open and edit its complete definition independently |
| `basic.recover` | HP Recovery | Open and edit its complete definition independently |
| `basic.recover.mp` | MP Recovery | Open and edit its complete definition independently |

Every supported auxiliary option must be discoverable in Game Content and editable whether or not it is the currently selected Support Action. Include it in the same Basic/inherent Skill workflow as Move and Basic Attack, using Parameters, Text, Media and History, real shared previews, Save Draft, atomic Publish and Restore to Draft. Editable supported mechanics include costs, cooldown, Requirements, ordered effects and applicable targeting; name, descriptions and artwork also belong to the full record. Validation must explain any actual unsupported conversion or native compatibility restriction rather than silently reverting an edited record to hardcoded defaults. Inspect remains an information control under existing authority.

Preserve stable command/content identities and use the same authoritative current/exact-version resolver and immutable encounter capture as the other editable Basics. A published edit reaches new encounter admission, availability, forecast, execution and shared readers coherently. Existing battles, pending effects and history retain their captured definitions. Draft changes have no runtime effect. The initial conversion preserves current AP, percentage recovery, Guard potency/duration, resource legality and independent Guard versus shared HP/MP cooldown rules until an explicit valid new published version changes them. Test changed authored values, not just renamed artwork or a selected-slot card.

The existing single saved Support Action choice still occupies slot 3, retains loadout/encounter pins and leaves the four selected Discipline Skills unchanged. This clarification adds editing coverage for all auxiliary definitions; it does not request extra combat slots or simultaneous availability of every auxiliary.

## Delivery and acceptance mapping

- Task2 preserves native Support Action behavior while establishing shared command preparation; Task3A extends the editable Basic definition resolver/capture to every authoritative Support Action option.
- Task5 includes all these records in full-record draft/publication/history/CAS/dependency services, preserving actual Owner publications and historical versions.
- Task7 migrates their actual current/pinned availability, forecast, cockpit information, Manual, Chronicle and public payload readers with recursive privacy checks.
- Task10 exposes every auxiliary in the panel with the complete working edit workflow, including options absent from the Owner's selected battle slot.
- Tasks13/16 demonstrate editor → draft → publish → new battle → outcome/readers for each option, plus old-battle immutability, stale publication rollback and the unchanged saved slot choice across desktop/mobile/keyboard. Add a registry-driven coverage assertion so an option cannot be omitted merely because it is not selected.

This clarification is binding approved scope. The original approved brief remains unchanged. Recording this addendum does not claim the editor or runtime integration is implemented.
