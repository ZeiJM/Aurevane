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

## 2026-08-24 clarity, identity, lifecycle, and narration contract

This addendum supersedes earlier examples that imply the default log should expose outcome chip clouds. The current player-facing rule is sentence-first: one causal combat beat, at most one immediate consequence line by default, and optional calm Details for useful tactical numbers.

### Identity resolution is required data

In PvP and spectator contexts, every battle-log consumer must receive a complete `combatantId -> characterName` map built from authoritative participant metadata. Both sides use `character:` combatant IDs, so treating every `character:` ID as the local viewer silently misattributes actor and target. When a PvP map is present but an ID is unexpectedly missing, presentation falls back to `Opponent`, never the viewer's name. AI/practice may continue using the explicit local `playerName` fallback because non-player opponents use recruit identities.

### Player-facing detail vocabulary

- resulting HP is labelled `{n} HP remaining`;
- attack probability is labelled `{n}% hit chance`;
- PvP timeout streaks are `consecutive timeouts`, never `misses`;
- movement cost is `{n} Move spent`;
- raw basis points, internal resource keys, sentinel durations, RNG rolls, and bare lifecycle words such as `Expired` never appear.

Lowered Guard applied by the PvP turn timer lasts until that combatant's next turn begins and makes that combatant take 2.5x normal incoming damage. The player-facing log may describe that mechanic plainly; it must never expose `25_000` basis points or the internal 1000-turn status-definition sentinel.

### Status lifecycle and grouping

Status durations count the affected status owner's upcoming turn starts, not global rounds. General authored statuses may display a concise `{n} turn(s)` duration. The PvP one-turn Lowered Guard presentation says `until next turn` because that is clearer than exposing the implementation counter.

`status_applied` events distinguish fresh application from authoritative refresh. Refresh renders as `{Target}'s {Status} refreshes`, while natural expiration renders as its own quiet `{Target}'s {Status} fades` event. Expiration is not dumped into an unrelated action's Details merely because both events share one battle-version commit. Immediate status consequences may attach to an action only when their target matches that action's actor/target attribution.

### Skill narration contract

Skill content may carry optional short presentation-only narration:

```ts
interface SkillNarrationTemplate {
  hit?: string
  miss?: string
  critical?: string
}
```

V1 allow-listed tokens are `{actor}`, `{target}`, `{ability}`, and `{damage}`. Unknown or malformed templates fail closed to the generic battle sentence; they never throw and never affect mechanics. `critical` is reserved in the content contract but is not selected until an authoritative critical outcome exists. Do not add blocked/dodged/parried variants until those outcomes exist mechanically. Pronoun-form tokens remain deferred until the authoritative identity/pronoun resolver is available.

Narration is evaluated only after committed combat events exist. It can change wording, never hit/miss, damage, targets, statuses, durations, costs, rewards, or any other authoritative result. Future Master Panel editing must use the same versioned contract with validation, preview, publish, audit, and rollback.


## Complete-history retention

Battle Log history is the complete sanitized projection of the persisted battle event stream for the authorized battle, not a rolling recent-event window. Database reads remain bounded and keyset-paginated, while the server composes the pages before projection so early rounds do not disappear as a battle grows.

Numbered rounds remain available for the entire battle and keep the existing newest-first/collapsed presentation. A genuinely roundless prelude may use the neutral `Battle` grouping, but the renderer does not expose a synthetic `Recent` bucket. Participant and active-spectator reads follow the same retention rule without changing combat authority or exposing raw event internals.
