from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:160]!r}')
    target.write_text(text.replace(old, new), encoding='utf-8')


replace_once(
    'TASKS.md',
    '**ACTIVE IMPLEMENTATION TICKET:** **P3.2 — Secondary Discipline + Independent Attunement Cooldowns**.\n\nP3.1 has a validated implementation candidate in PR #368 at `28c00c92f242b4344f8dae80ef8c32e05774a694` and is the direct dependency for P3.2. P3.2 now implements the optional mastered Secondary slot plus independent server-owned Primary/Secondary attunement cooldowns and is in final validation. Do not start P3.3 until P3.2 is closed or the Owner explicitly authorizes parallel work.',
    '**ACTIVE IMPLEMENTATION TICKET:** **P3.3 — Mature Skill Schema + Generic Cooldown Engine**.\n\nP3.1 remains the validated foundational dependency in PR #368. P3.2 is implemented and validated in stacked PR #369 at `f1910fbea315a48f5ff932f1e0640aa9ac1e4752`. The Owner explicitly authorized continuing Phase 3, so P3.3 is now the active implementation/validation ticket on top of that exact P3.2 head. P3.4 persistent learned/equipped Skill loadouts and pure/mixed capacity remain deferred until P3.3 closeout.',
)
replace_once(
    'TASKS.md',
    '### Active P3.2 contract\n\nP3.1 supplies the validated authoritative persistent build-state boundary, versioned Primary definitions/base profiles, deterministic derived-stat recomputation, build versioning, idempotency and Profile preview/commit flow through dependency PR #368.\n\nP3.2 adds only the next canonical layer: an optional mastered Secondary, no second base-stat profile, independent trusted-server Primary/Secondary attunement deadlines, preview-versus-commit separation, reconnect/device-clock safety, auditable legality and understandable Profile lock state. Mature Skill schema/cooldowns, Skill loadouts, Resonance and Essence remain deferred to P3.3+.',
    '### Active P3.3 contract\n\nP3.1 supplies the authoritative persistent build-state boundary and versioned Primary profiles. P3.2 adds the optional mastered Secondary plus independent trusted-server Primary/Secondary attunement deadlines through stacked PR #369.\n\nP3.3 adds only the next canonical layer: versioned mature Skill definitions, reusable server-owned owner-turn cooldown state, deterministic readiness across persisted battle snapshots, shared target/requirement/effect legality, shared AI legality, PvE/PvP tuning hooks and representative data-defined Discipline Skills. The canonical Recover command now uses its specified two-owner-turn cooldown while Move, Basic Attack and Guard remain cooldown-exempt. Persistent learned/equipped Skill loadouts, pure/mixed capacity enforcement and Profile configuration remain deferred to P3.4.',
)

replace_once(
    'AGENTS.md',
    'Phase 3 — Signature Buildcraft Foundation     active; P3.2 after validated P3.1 dependency',
    'Phase 3 — Signature Buildcraft Foundation     active; P3.3 after validated P3.1/P3.2 dependencies',
)
replace_once(
    'AGENTS.md',
    'Current execution: P3.1 is implemented and validated in PR #368 at `28c00c92f242b4344f8dae80ef8c32e05774a694`; P3.2 is active. Do not begin P3.3 until P3.2 closeout unless the Owner explicitly authorizes parallel work.',
    'Current execution: P3.1 is implemented and validated in PR #368 at `28c00c92f242b4344f8dae80ef8c32e05774a694`; P3.2 is implemented and validated in stacked PR #369 at `f1910fbea315a48f5ff932f1e0640aa9ac1e4752`; the Owner explicitly authorized continuing Phase 3 and P3.3 is active. Do not begin P3.4 until P3.3 closeout unless the Owner explicitly authorizes parallel work.',
)

replace_once(
    'docs/ROADMAP.md',
    '| Phase 3 — Signature Buildcraft Foundation | 🛠️ Active — P3.2 | P3.1 is validated on the stacked dependency; P3.2 is the current implementation/validation ticket. |',
    '| Phase 3 — Signature Buildcraft Foundation | 🛠️ Active — P3.3 | P3.1 and P3.2 are validated stacked dependencies; P3.3 is the current implementation/validation ticket. |',
)
replace_once(
    'docs/ROADMAP.md',
    '- preserve the validated P3.1 Discipline build authority + Primary profiles dependency and execute P3.2 Secondary + independent attunement cooldowns;',
    '- preserve the validated P3.1 Discipline build authority + Primary profiles and P3.2 Secondary + independent attunement dependencies, then execute P3.3 mature Skill schema + generic cooldown authority;',
)
replace_once(
    'docs/ROADMAP.md',
    '- pulling P3.3+ or Phase-4+ content into P3.2 without a tightly coupled prerequisite;',
    '- pulling P3.4+ or Phase-4+ content into P3.3 without a tightly coupled prerequisite;',
)
