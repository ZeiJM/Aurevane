from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old!r}")
    path.write_text(text.replace(old, new))


tasks = Path("TASKS.md")
replace_once(tasks, "**Reconciled:** 2026-09-02", "**Reconciled:** 2026-09-03")
replace_once(
    tasks,
    "**ACTIVE IMPLEMENTATION TICKET:** **P3.1 — Discipline Build Authority + Primary Base Profiles**.",
    "**ACTIVE IMPLEMENTATION TICKET:** **P3.2 — Secondary Discipline + Independent Attunement Cooldowns**.",
)
replace_once(
    tasks,
    "No Phase-3 runtime implementation is performed by the closeout itself. The next implementation work should start from current `main`, audit/reuse the existing battle platform, and execute P3.1 first.",
    "P3.1 has a validated implementation candidate in PR #368 at `28c00c92f242b4344f8dae80ef8c32e05774a694` and is the direct dependency for P3.2. P3.2 now implements the optional mastered Secondary slot plus independent server-owned Primary/Secondary attunement cooldowns and is in final validation. Do not start P3.3 until P3.2 is closed or the Owner explicitly authorizes parallel work.",
)
replace_once(
    tasks,
    """### P3.1 starting contract

P3.1 must create/reconcile one authoritative persistent build-state boundary and make Primary Discipline mechanically meaningful through versioned base-stat profiles while preserving separately owned player-assigned attributes.

Start by auditing current repository truth against `docs/PHASE_3_TICKETS.md`; do not assume older Phase-1 Primary placeholders already satisfy the mature P3.1 contract.""",
    """### Active P3.2 contract

P3.1 supplies the validated authoritative persistent build-state boundary, versioned Primary definitions/base profiles, deterministic derived-stat recomputation, build versioning, idempotency and Profile preview/commit flow through dependency PR #368.

P3.2 adds only the next canonical layer: an optional mastered Secondary, no second base-stat profile, independent trusted-server Primary/Secondary attunement deadlines, preview-versus-commit separation, reconnect/device-clock safety, auditable legality and understandable Profile lock state. Mature Skill schema/cooldowns, Skill loadouts, Resonance and Essence remain deferred to P3.3+.""",
)

roadmap = Path("docs/ROADMAP.md")
replace_once(
    roadmap,
    "| Phase 3 — Signature Buildcraft Foundation | 🛠️ Active — P3.1 | Phase 3 is active on the formally closed Phase-2 baseline. |",
    "| Phase 3 — Signature Buildcraft Foundation | 🛠️ Active — P3.2 | P3.1 is validated on the stacked dependency; P3.2 is the current implementation/validation ticket. |",
)
replace_once(
    roadmap,
    "- begin with P3.1 Discipline build authority + Primary profiles;",
    "- preserve the validated P3.1 Discipline build authority + Primary profiles dependency and execute P3.2 Secondary + independent attunement cooldowns;",
)
replace_once(
    roadmap,
    "- pulling later Phase-3 tickets or Phase-4+ content into P3.1 without a tightly coupled prerequisite;",
    "- pulling P3.3+ or Phase-4+ content into P3.2 without a tightly coupled prerequisite;",
)
replace_once(
    roadmap,
    "No Soulmark/Mantle or frontier implementation is required here.\n\n**Gate:**",
    "No Soulmark/Mantle or frontier implementation is required here.\n\n**Current ticket:** P3.1 is implemented and validated in dependency PR #368 (`28c00c92f242b4344f8dae80ef8c32e05774a694`). P3.2 is the active ticket; P3.3 remains deferred until P3.2 closeout unless the Owner explicitly authorizes parallel work.\n\n**Gate:**",
)

agents = Path("AGENTS.md")
replace_once(
    agents,
    "- `docs/PHASE_3_TICKETS.md` is the exact next implementation sequence once Phase 2 is explicitly closed.",
    "- `docs/PHASE_3_TICKETS.md` is the exact active Phase-3 implementation sequence.",
)
replace_once(
    agents,
    """Phase 2 — Tactical Combat & Battle Platform   implementation mature; Owner testing / PV-1 exit open
Phase 3 — Signature Buildcraft Foundation     next major phase after explicit Phase-2 closure""",
    """Phase 2 — Tactical Combat & Battle Platform   closed; PV-1 passed by explicit Owner decision
Phase 3 — Signature Buildcraft Foundation     active; P3.2 after validated P3.1 dependency""",
)
replace_once(
    agents,
    "Phase 2 formally includes reusable tactical combat, Recruit AI/Battle Hall, direct PvP, multi-combatant battles, spectation, battle communication, battle logs and responsive battle presentation already delivered.",
    "Phase 2 is formally closed and its reusable tactical combat, Recruit AI/Battle Hall, direct PvP, multi-combatant battles, spectation, battle communication, battle logs and responsive battle presentation are preserved dependencies for Phase 3.",
)
replace_once(
    agents,
    "Before Phase-3 runtime code:",
    "The completed Phase-2 → Phase-3 transition protocol was:",
)
replace_once(
    agents,
    "Phase-transition authorization does **not** authorize Vercel deployment.",
    "Phase-transition authorization does **not** authorize Vercel deployment.\n\nCurrent execution: P3.1 is implemented and validated in PR #368 at `28c00c92f242b4344f8dae80ef8c32e05774a694`; P3.2 is active. Do not begin P3.3 until P3.2 closeout unless the Owner explicitly authorizes parallel work.",
)
