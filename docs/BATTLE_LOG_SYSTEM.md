# AUREVANE — Battle Log System

**Status:** Battle-log implementation direction subordinate to `docs/COMBAT.md`, `docs/BATTLE_INTERFACE.md`, `docs/MASTER_PANEL.md`, and `docs/ENGINEERING_EXECUTION_STANDARD.md`.

**Direction approved:** 2026-08-22.

## North Star

AUREVANE battle history should be **rich, not verbose**.

The log exists to answer, at a glance:

- what action happened;
- who acted and who was affected;
- what the important outcome was;
- which round/turn it belonged to;
- which statuses/resources changed when they matter.

It should not read like a database trace or a wall of combat prose.

## Player-facing structure

The shared AI/PvP presentation is:

```text
ROUND
  Action
  Actor → Target
  [HIT] [34 DMG] [Bleeding · 2 turns]
```

Rules:

- newest round first;
- newest round opens by default;
- older rounds collapse into compact headers;
- one committed action is one visual unit even when several authoritative events produced it;
- low-level bookkeeping such as AP spending, turn-start plumbing and facing commits is folded into the action or omitted unless independently useful;
- outcomes use compact fact chips rather than repeated sentences;
- color reinforces meaning but never carries meaning alone;
- long narrative paragraphs are not the default battle-log format;
- AI battles, live PvP battles and PvP spectator history use the same renderer.

## Authority and data flow

The persisted authoritative event stream remains the source of truth.

The battle-log service projects that stream into a sanitized presentation model containing:

- event identity/version;
- actor and target references;
- action identity/label;
- round/turn context;
- semantic kind and tone;
- concise outcome facts;
- a safe plain-text message template and template values.

The projection must never expose private RNG rolls, internal AI utility values, secrets, or other raw resolution payloads merely to make the UI richer.

## Template direction

Battle narration is data presentation, not game authority. A text template can describe an already-resolved authoritative event, but it cannot decide damage, hit chance, statuses, costs, targets or rewards.

Current implementation uses safe plain-text brace tokens such as:

```text
{actor} used {action}.
{actor} {action} {outcome}.
{target} took {amount} damage.
{target} gained {status}.
```

This is the foundation for future Master Panel content authoring. The eventual Combat Content / Skill editor should support versioned templates through the existing Draft → Preview → Publish → Rollback workflow rather than source-code edits.

Future author-facing identity tokens may include grammatical forms such as:

```text
{actor.subject}
{actor.object}
{actor.possessive}
{actor.reflexive}
{target.subject}
{target.object}
{target.possessive}
{target.reflexive}
```

Those tokens should only become publishable when AUREVANE has an authoritative character identity/pronoun model to resolve them correctly. Until then, content must not guess gender from names, portraits, body type or other presentation data.

## Master Panel requirements

When battle-log copy becomes authorable in `/master`, the editor should provide:

- an allow-listed token picker rather than arbitrary executable interpolation;
- sample actor/target preview;
- validation for unknown/missing tokens;
- plain-text output only unless a later reviewed rich-text format is explicitly approved;
- fallback copy when a template is absent or invalid;
- version history and rollback with the owning Skill/effect definition;
- audit provenance for published changes.

Mechanics remain typed/server-authoritative. Templates are presentation only.

## Success standard

A good battle log lets a player reconstruct the fight quickly without reading every engine event. Richness comes from hierarchy, identity, outcome facts, statuses and context — not from adding more words.
