# Discipline grants and relationship selection — local implementation

This is local source work for the October 27 Master Panel batch, not a hosted migration or release receipt.

## Grants

`DisciplinePlayerGrants({disciplineId})` searches current verified player names, lets staff select several stable account recipients, records a reason and manages/revokes existing grants. Search never accepts the displayed name as authority. The server rechecks `content.combat.author` and injects the currently selected actor character. The service-only SQL RPCs repeat live page authorization and validate every recipient; a bad recipient rolls back the whole batch. Queries and batches are bounded (20 search results, 100 current grants per cursor page, 50 recipients per write). Duplicate grant/revoke retries do not duplicate audit entries.

Grants are account entitlements, separate from character Mastery and Skill grants. They bypass ordinary unlock requirements, including a complete authored `unavailable` (grant-only) Discipline, while disabled/archived/unpublished Disciplines stay unavailable. Both Primary and Secondary selection support the entitlement. Grant-only publication also gates initial character-build provisioning; it does not use the global testing convenience. Catalogue `player_granted` allows Secondary selection without supplying a fictitious `mastered_at`; no earned stage, XP, skill provenance or trial credit is written. Stage A drafts missing the producer envelope remain unpublishable.

Revocation removes eligibility for future choices. It does not rewrite a player's already selected build or any battle capture. A currently selected Discipline can remain selected after revocation until the player changes it. Account deletion cascades the entitlement; immutable audit identity values do not block account/character deletion.

## Relationship override

`AuthoredDiscipline.relationshipOverride` is optional. Absent/null retains all ordinary individual mappings. `{withDisciplineId:null}` selects the current `essenceId`; `{withDisciplineId:'partner'}` selects that existing `resonanceSelections` entry. The parser and SQL reject missing, unsupported or unmapped choices. Turning the option off restores the existing mappings without rewriting them.

The chosen original power applies with any partner or no partner. When both equipped Disciplines override, exactly one wins: the lexicographically smaller stable Discipline ID under PostgreSQL `C` collation. This priority is independent of Primary/Secondary order. The original Essence source or Resonance pair remains unchanged; there is no reskinning of its requirements, costs or mechanics. A Resonance may still require skills/effects from its original pair: the override supplies that authored power, not new ways to meet its requirements.

New references carry optional `relationshipOverrideDisciplineId`, identifying the active Discipline that supplied the exceptional selection. Current SQL selection, application resolver, committed build parser, new battle authority and ability capture preserve the exact original power/version and this provenance. New player admission compares the two exact supported power references to the server's current committed snapshot, rejecting forged override metadata. Historical references without the optional field retain ordinary pure/mixed rules and immutable pinned behavior. Editing or disabling the override does not rewrite old captures.

## Integration

- `components/master/combat-content/discipline-player-grants.tsx`: `DisciplinePlayerGrants({disciplineId})`.
- `components/master/combat-content/relationship-override-fields.tsx`: `RelationshipOverrideFields({value:AuthoredDiscipline,onChange:(next)=>void,choices:readonly {id,label}[]})`.
- `/api/master/discipline-player-grants` accepts `search`, `read`, `grant`, `revoke` via POST. Read supports an optional stable `after` account cursor.
- CLI-created migration: `20261027123133_discipline_player_grants_relationship_override.sql`.

Focused evidence and final integrated results are recorded in the main batch handoff. Hosted SQL, native signed-in browser and human gameplay acceptance remain separate.

## Focused local evidence

- Core: 56 passing tests across authored content, relationship parser, Atlas and build snapshots.
- Web: 60 passing tests across grants handler, current selection resolver and character build service; 3 passing creation/catalogue tests.
- New PvE/PvP authority: 2 passing tests covering pure Resonance and mixed Essence through exact capture, serialized reload and native ability source production; 312 adjacent cases intentionally filtered in that invocation.
- Real migration SQL: 5 passing producer cases covering pure/mixed/reversed selection, deterministic dual overrides, off restoration, grant-only Primary/Secondary, testing-on restrictions, revocation and forged admission denial. A separate actual `create_character_v4` grant-only Foundation negative/positive case passes.
- Grant SQL: 2 passing security/atomicity/audit cases, plus the passing multi-recipient/character-rename/no-Mastery case. Its full migration fixture timeout is 120 seconds; the 60-second hook expired once during concurrent worker CPU contention, rather than reporting a SQL assertion failure.
- Domain core/DB ESLint and domain web ESLint pass. The integrated batch owns final whole-tree typecheck, required tests and browser evidence. No hosted migration, publication or deployment was performed here.
