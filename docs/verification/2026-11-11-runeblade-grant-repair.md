# Runeblade grant repair

Nick reported that the Master panel could not grant Runeblade to a verified player. Production PostgreSQL logs at 08:41 UTC on November 11 identify `DISCIPLINE_GRANT_UNAVAILABLE` in `write_discipline_player_grants_v1`, before recipient validation. The selected player was verified and not pending deletion.

Runeblade publication 4 disabled the Discipline on October 26. Publication 5 on November 11 changed its unlock rule to `always`, but retained `enabled: false`. The Primary/Secondary flags were individually true, while the current-definition projection correctly made both effective availability flags false. The existing Identity → Enabled control remains present; the database grant guard is working and is not weakened by this fix.

## Live content repair

At **08:51:29 UTC / 04:51:29 Trinidad time, November 11, 2026**, a guarded normal `commit_combat_content_record_v1` operation published Runeblade version 6, changing only `enabled` to true plus the ordinary version increment. The operator was the verified authorizing Owner and selected Owner character. It required active record revision 12, publication 5, no Runeblade draft, the reviewed definition hash and the fresh catalogue token. A changed source would abort.

The same transaction verified that the resulting definition equals publication 5 except for `enabled` and `contentVersion`, and that the current-definition projection enables both Primary and Secondary. It fingerprinted and preserved all prior Runeblade versions, every unrelated publication, every Owner draft and the existing Runeblade grant count. Independent readback confirmed version 6 and both availability flags true. Publication 5 still has MD5 `dd63509ec77e61179825f44b100b91c7`. No player grant was added, no Mastery/progression was forged, and no schema migration or application deployment was required for this repair. Nick can refresh the panel and retry his intended grant.

## Error guidance

The route previously mapped every `DISCIPLINE_GRANT_*` error to the same refresh instruction. The source correction distinguishes an unavailable Discipline from an unavailable recipient, telling staff to enable/commit the former or search verified active players again for the latter. It retains authentication, capability checks, selected-character authority, input validation, database status codes and generic non-disclosing failure handling. It does not permit grants of disabled content.

Both new response regressions failed against the original mapping. Focused grant, selected-character and atomic content-commit tests pass (46 tests); web TypeScript, scoped ESLint and formatting are verified before publication. Exact-head configured checks still apply before integration. No schema, combat, world, UI layout or migration behavior changes; database-authority and World suites need not repeat solely for error copy. The source guidance is separate from the already-live content correction and may accompany the authorized combined world-art production release.
