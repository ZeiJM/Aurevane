# AUREVANE — Concurrent Agent Engineering Workflow

**Status:** Authoritative execution protocol for AI-assisted coding when multiple chats/agents may be active.

**Purpose:** Prevent regressions caused by stale repository state, overlapping edits, symptom-only fixes, incomplete verification, and unsafe production pushes.

AUREVANE is frequently developed through several concurrent coding chats. Therefore **`main` must be treated as volatile**. A correct change based on an old snapshot can become an incorrect change minutes later.

---

## 1. One task, one branch, one owner

Unless the Owner explicitly requires direct work on `main`, each independent coding chat/task must use its own branch:

```text
agent/<short-task-name>
```

Rules:

- Do not share a working branch between independent active chats.
- Do not use another chat's handoff snapshot as repository truth.
- A chat owns only the files/behavior needed for its assigned task.
- Do not merge unrelated work into a task merely because it is nearby.
- Never force-push `main`.
- Production deployment is a separate Owner-controlled action and does not automatically follow a merge.

If direct work on `main` is explicitly required, the freshness checks in this document become mandatory immediately before every write/push.

---

## 2. Mandatory fresh-main preflight

Before diagnosis or editing, refresh repository truth.

Recommended local commands:

```bash
git fetch origin main
git status --short
git log --oneline --decorate -8 origin/main
```

Then:

1. identify the current `origin/main` SHA;
2. read the current versions of every file likely to be touched;
3. read applicable authoritative docs and `AGENTS.md`;
4. inspect recent commits affecting the same subsystem;
5. verify assumptions against current code instead of relying on a handoff or earlier chat summary.

If working directly on a clean local `main`, fast-forward before editing:

```bash
git pull --ff-only origin main
```

Do not begin from a stale mental model.

---

## 3. Diagnose the system, not the symptom

Before changing code, trace the complete execution path relevant to the bug or feature.

For gameplay/state bugs, inspect as applicable:

```text
PLAYER / TIMER / REALTIME EVENT
  -> UI intent
  -> route/server boundary
  -> authoritative domain service
  -> state machine / game rules
  -> persistence / transaction
  -> realtime/refetch/update
  -> resulting UI
```

Explicitly identify:

- the source of truth;
- who is allowed to mutate it;
- the transition that should occur;
- the transition that must never occur;
- retry/idempotency behavior;
- timeout/no-input behavior;
- terminal-state behavior;
- AI/PvP/spectator/training differences where the shared path is reused.

Do not patch a visible UI symptom when the authoritative state transition is wrong.

---

## 4. Bug-fix regression contract

A bug fix is incomplete without a regression guard when a practical automated test boundary exists.

Preferred sequence:

1. reproduce or prove the faulty path;
2. add a focused failing regression test, or define the exact failing assertion before the code fix;
3. make the smallest root-cause change;
4. run the focused test;
5. run adjacent tests for the shared subsystem;
6. run the full quality gate before declaring completion.

Regression tests should cover both:

- the behavior that **must happen**; and
- the behavior that **must not happen**.

For timer/state-machine defects, include the relevant matrix rather than testing only the reported happy path. Typical dimensions include:

- player acts before timeout;
- player does nothing until timeout;
- repeated timeout ticks/retries;
- already-terminal battle/session;
- victory/defeat conditions near the timeout boundary;
- guided training vs normal battle;
- AI vs PvP where code is shared;
- reconnect/refetch after the transition.

A timeout must never be treated as an implicit victory, completion, reward, or successful player action unless the authoritative game rule explicitly says so.

---

## 5. Surgical-change rule

Before editing, state the intended behavioral delta in one sentence.

Then preserve everything outside that delta.

Do not casually change:

- combat rules;
- grid geometry;
- desktop/mobile layout behavior;
- spectator behavior;
- battle logs;
- chat/realtime behavior;
- server authority;
- reward/progression semantics;
- unrelated styling;
- unrelated files or formatting.

If a broader refactor is genuinely required for correctness, explain why it is required and keep it isolated from unrelated cleanup.

---

## 6. Player-facing UI verification

For meaningful UI changes, automated checks are necessary but not sufficient.

Verify the actual rendered flow when tooling permits, including the relevant combinations of:

- desktop and mobile;
- AI battle and PvP;
- active participant and spectator;
- empty/loading/error/terminal states;
- long text/log content where layout could overflow;
- the exact interaction reported by the Owner.

Check browser console/runtime errors when browser verification is available.

Do not declare a UI fix complete solely because TypeScript compiles.

---

## 7. Mandatory fresh-main finalization gate

Immediately before committing/merging/pushing a completed task, refresh `main` again:

```bash
git fetch origin main
git log --oneline HEAD..origin/main
git diff --name-only HEAD...origin/main
```

If `origin/main` advanced while the chat was working:

1. inspect the new commits;
2. identify overlapping files, shared services, schemas, state machines, styles, or tests;
3. reconcile the task with current `main`;
4. rerun targeted tests;
5. rerun the full required quality gate.

If there is meaningful overlap, **do not push the stale version first and fix it later**.

This final freshness gate is mandatory even when the code change itself is small.

---

## 8. Required verification before completion

At minimum, use the checks appropriate to the changed scope. The repository-wide quality gate is:

```bash
pnpm check
```

Also inspect the patch itself:

```bash
git diff --check
git diff --stat
git diff --name-only
```

For a branch relative to current main, inspect the full task diff:

```bash
git diff origin/main...HEAD
```

Before claiming success, verify:

- no unexpected files changed;
- no broad formatting churn occurred;
- no duplicate source of truth was introduced;
- no tests were weakened merely to make them pass;
- no debug logging/temporary bypass remains;
- authoritative server behavior is still authoritative;
- the reported bug has a regression guard when practical;
- relevant adjacent behavior still passes.

If any required check cannot be run, state exactly what was and was not verified. Do not imply stronger validation than actually occurred.

---

## 9. Commit and merge discipline

A task commit should tell one coherent story.

Prefer:

- focused commits;
- descriptive commit messages;
- regression test and fix in the same logical task;
- current-main reconciliation before merge;
- rerunning verification after conflict resolution.

Avoid:

- giant mixed-purpose commits;
- drive-by refactors;
- merging unresolved conflict markers or guessed resolutions;
- changing tests to match broken behavior;
- bypassing CI because a change "looks small".

---

## 10. Production release rule

A production request means: deploy the **verified, current-main-compatible result**, not merely the last local/chat snapshot.

Before production:

1. confirm deployment was explicitly requested in the current work item;
2. perform the final fresh-main gate;
3. confirm CI/required checks are passing on the release state;
4. verify the deployed commit SHA is the intended commit;
5. perform the relevant production smoke check when possible.

If another concurrent change lands after validation but before production and overlaps the same system, re-evaluate and re-test before releasing.

---

## 11. Completion report standard

Every coding task completion should state concisely:

- root cause;
- files/behavior changed;
- regression coverage added;
- verification actually run;
- whether current `main` changed during the task and how it was reconciled;
- commit/branch used;
- production deployment status, only when applicable.

This makes concurrent work auditable and reduces repeated diagnosis in later chats.

---

## 12. Non-negotiable principle

**Correctness over speed. Current repository truth over chat memory. Root cause over symptom patching. Regression protection over one-time success.**
