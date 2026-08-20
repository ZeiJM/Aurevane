# Public identity hotfix — 2026-08-20

The Online/public character identity projection queried `discipline_id`, but the canonical `characters` column is `foundation_discipline_id`. PostgREST rejected the projection, and the service deliberately failed closed by returning null public identity fields. The UI therefore showed neither the Discipline nor the personal title even though both existed in Production data.

This hotfix switches the projection to `foundation_discipline_id` and maps it back to the existing `disciplineId` view-model field. No schema change is required.
