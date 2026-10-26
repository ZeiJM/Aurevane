# Staff role defaults and workspace — local implementation

October 26, 2026. Task 4 plus the Staff portion of Task 3 on the shared `agent/master-panel-refinements-20261026` working tree. Not deployed; no hosted SQL mutation, migration application, push or commit was performed for this task.

## Result

The Game Owner can edit and save defaults for Moderator, Content Staff and Event Staff. The complete role map has a persisted revision; stale saves fail and retain the local draft. Defaults apply to existing role holders on their next protected request, without rewriting character grants. Explicit grants remain additive. The selected linked character, current ownership, deletion state, expiry and revocation continue through the existing authoritative reader. Owner-only management and global settings cannot be added to a delegated default.

The server uses `read_master_panel_access_v2` and strictly validates its authoritative effective capability snapshot. SQL content operations and operator lookup use the same live defaults. Event authoring/scheduling and live operations have separate capability gates; the physical regression also proves that author-only scheduling scope remains available and operate-only staff do not acquire authoring.

Staff has a bounded directory and editor with internal scrolling, aligned Staff/Roles/Status/Actions columns shared by the Owner and delegated rows, and an Owner defaults editor in the right workspace. Editing a character replaces that defaults editor; Close returns to it. Directory Edit opens the sole character editor, where Save and Revoke retain their existing confirmation/expiry behavior. Duplicate directory Revoke was removed because it only opened that same editor. Explanations live behind the click/tap help control.

Migration created with `pnpm exec supabase migration new master_panel_role_defaults`:

- `supabase/migrations/20261026062311_master_panel_role_defaults.sql`
- Private RLS configuration, no direct table privileges for anon/authenticated/service_role.
- Owner-only read/save RPCs with a locked revision check and authoritative saved readback.
- Service-only capability snapshot RPC, private content/event capability gates and retained predecessor overloads.
- Existing immutable gameplay captures are untouched.

## Verification

Observed RED before implementation:

- Service lacked defaults read/save and still reconstructed the original role presets instead of using live effective capabilities.
- Physical database lacked the defaults RPC/table.
- Owner defaults UI was absent; the later directory regression caught the redundant Revoke control.
- Event author-only scheduling was denied by the first operations-gate change; the corrected migration preserves scheduling authority and separates operation scope.
- Browser console guard caught invalid help-dialog markup nested in a paragraph; the expiry container was corrected and the same browser check passed cleanly.

Final scoped commands/results:

- `pnpm --filter @aurevane/web exec vitest run src/server/master/staff-access.test.ts src/server/master/staff-access-handler.test.ts src/server/master/supabase-staff-access-store.test.ts src/server/master/selected-staff-factory.test.ts src/components/master/staff-management.test.tsx src/components/master/staff-focus-interaction.test.tsx src/components/master/master-panel-shell.test.tsx` — **7 files, 45 tests passed**.
- `pnpm --filter @aurevane/db exec vitest run src/selected-character-staff-authority.test.ts` — **18 physical tests passed**, including actual draft writes/denials after changed defaults, stale CAS, selected/alternate-character boundaries, additive explicit grants, live expiry/revocation, separated event gates and native browser invocation denial with a forged Owner ID.
- The transitive Master entry endpoint regression: `pnpm --filter @aurevane/web exec vitest run src/app/api/master/access/route.test.ts` — **5 tests passed**.
- Scoped ESLint, including the new browser script/fixture, and `pnpm --filter @aurevane/web exec tsc --noEmit --pretty false` — passed.
- `git diff --check` — passed.
- `AV_STAFF_BROWSER_EXECUTABLE=/tmp/task13-recovery-browser/chromium node apps/web/scripts/staff-management-browser-regression.mjs` — actual Staff and Master shell components passed at **1366×768** and **390×844** in Chromium **153.0.8010.0**. Both exercise default save/readback, stale-draft retention, help Escape/focus restoration, linked-character selection and confirmed access saving. Long directory columns align and the directory scrolls internally; save controls are visible, unobscured and have visible keyboard focus. No page or console errors. The local HTTP/session transport is a fixture; this browser evidence does not claim hosted authorization or persistence.
- Browser screenshots and measurement receipt: `/tmp/staff-browser-evidence/` (`desktop-directory.png`, `desktop-editor.png`, `mobile-directory.png`, `mobile-editor.png`, `receipt.json`). Screenshots were inspected.

An earlier adjacent Master run passed 44 files / 1,774 tests. An earlier database package run passed 348 of 350 tests and exposed two in-flight integration inventory failures in `combat-content-record-lifecycle.test.ts`: `combined actor inventory includes original33 Players4 Content4 Media2 Event2 with private helpers inaccessible` and `executes the complete native Staff fixture with all 45 real actor contracts on the current migration chain`. Root owns reconciling that fixture with the two new role-default actor contracts and the new commit RPC, then the final full integration gate. No full-suite success is claimed here.

## Remaining acceptance

Genuine 200% browser zoom was attempted through a disposable Chrome extension using `chrome.tabs.setZoom`; this recovery Chromium build did not expose the extension service worker. The receipt explicitly marks this unavailable. CSS zoom was not substituted. Full integration quality, native CI, real 200% zoom, hosted signed-in/physical-device acceptance and any production release remain separate gates.

Root owns the Staff page wiring, the selected-character RPC allowlist and shared Master shell. The authorized transitive `/api/master/access` entry-link fix also uses effective `master.access`; its endpoint tests observed RED for retained roles without entry permission, then GREEN after the repair (5 tests). The migration must be applied before the app begins requesting the new authoritative snapshot RPC.
