# Master current catalogue and saved Skill drafts

Task5/10 integration subset from local3e365c9e2fbf96e633fa2c32c40294d96862a752 / durablef50c803004abeaec152a507d1f8e2ae2cc06911d / tree794b918f4e8bf2f3e24b2f782a439438449e62a0, draftPR904. No hosted mutation, publication, migration, merge or deployment is performed. This does not complete Basic authoring, the whole Master workspace, the roster or the requested partial release.

## Behavior

The protected Combat Content page now obtains its selected current Skill, Essence and Resonance records and effect-timing policy from the existing complete atomic catalogue. It no longer reconstructs the current list from enabled builtin Skills and inferred Discipline pairs, independently rereads current pointers, or reads a different timing policy after assembling definitions. Custom and disabled current publications stay available to authorized editors. Catalogue failures remain explicit; no silent builtin resurrection is introduced.

Drafts and immutable publication history remain separate per-record reads, bounded to four records at a time. Typed draft kind must match the authoritative current record. Builtin history is added only for actual builtin identities; custom publications do not acquire invented static baselines. History marks the snapshot's selected current version, even if a later history read races a pointer change. The catalogue token and unrelated status/profile definitions are not serialized into workspace props. An explicitly null draft base is preserved.

The actual Skill editor now initializes from its saved draft when present, while retaining the current definition as the comparison baseline. Canonical drafts preserve their targeting and use the shared modular form; native drafts retain existing target normalization. Essence and Resonance retain their independently loaded drafts.

## Verification

Actual page tests reproduce missing custom Skills, omitted custom Essence/Resonance entries and the wrong enumeration path on original source; the original Skill renderer also fails the saved unpublished text assertion. A separate regression exposes null draft bases being replaced by the current version. These fail before their fixes and pass afterward. Seven page cases cover custom/disabled current records, older current selection and legitimate builtin history, separate drafts, matching timing, unavailable catalogue, access-before-private-read and mismatched draft kind. The rendered Skill draft regression passes with the existing editor suite. All52 covering cases across four page/editor/catalogue files pass.

The full `pnpm check` exits0:6,073 Vitest plus7 Node checks, formatting, lint, eight typechecks and both builds pass. Full output is recorded in `master-catalogue-full-check.log`. No product source changes follow that gate before this checkpoint. The earlier exactf50c8030 canonical form native workflow passed16 contexts and its downloaded verified screenshots were inspected; see the appended receipt in `2026-10-15-canonical-ability-editor.md`. Those fixture interactions do not establish hosted publication or this page's hosted catalogue behavior.

## Remaining work

All five Basic records still need actual Master form and publication-preview integration. Full create/duplicate/archive/restore-to-draft, editor-observed CAS, malformed saved draft recovery, typed reference pickers, selected Manual group preview and Automatic/Ongoing review remain open. Historical publication allocation against the builtin version namespace needs its own real regression investigation. Release still requires the full editor-to-save-to-publication-to-new-battle chain, current main integration, migrations, complete roster and reviewed deployment.

The preceding exactf50c8030 broad Atlas run38757396490/job116499331350 fails its known-neighbour interpolation bound:0.7776524902064921 against<0.75. That result is retained as an unresolved browser gate; no prediction bound is changed and no clean full-browser result is claimed. The remaining Browser smoke run was still in progress at inspection.

React review: authenticated server-only reads precede private serialization; no new production effect, listener or client request. Existing stable IDs, keyed workspace remount and immutable state initialization remain. Independent per-record draft/history reads share bounded batches. Existing private Master authoring receives definitions; public readers are unchanged.
