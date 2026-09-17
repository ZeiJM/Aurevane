# AUREVANE — Covert Buff-Log Privacy Amendment

**Status:** Self-review correction to the Owner-approved Covert/Sensory/Revealed design  
**Applies to:** `2026-09-12-covert-sensory-revealed-design.md`

## Authority

This amendment closes an information leak discovered during spec self-review. Where it conflicts with the parent Covert/Sensory/Revealed design, this amendment wins.

## Hidden positive-status lifecycle events

While a combatant is Covert, opposing viewers must not receive positive-status lifecycle log details for that combatant, even when the positive effect came from another actor rather than from the Covert combatant's own hidden action.

For a Covert target, opposing log projection therefore suppresses or non-identifyingly redacts events such as:

- positive status applied;
- positive status refreshed;
- positive status stacked;
- positive status removed;
- positive status expired;
- other positive-active-effect lifecycle events whose payload would reveal the hidden buff identity, magnitude, stack count, or duration.

This uses the pinned effect/status definition's `polarity: positive` metadata rather than a hard-coded status-name list.

Negative-status lifecycle events remain visible unless another mechanic explicitly hides them.

## Allied actions that create hidden buffs

Covert does not make a non-Covert ally's own action identity secret. If an ally visibly uses a Skill on the Covert combatant, the opponent may infer possibilities from that observable action. However, the Covert target's actual positive status inventory, status lifecycle details, stack count, magnitude, and remaining duration are still omitted from opposing projections/log entries.

The implementation must not add a second layer of action redaction to non-Covert allies merely because their action affected a Covert unit.

## Reveal boundary

When Sensory successfully Reveals the Covert target:

1. hidden positive buffs are purged authoritatively;
2. Covert ends;
3. Revealed is applied;
4. from that Reveal event forward, the opponent is entitled to the removal outcome and future ordinary status/action visibility;
5. previously hidden action history and previously suppressed positive-status lifecycle history are **not retroactively reconstructed** for the opponent.

The Reveal event may truthfully identify the buffs removed at the moment of successful Reveal, because the secrecy state has been broken at that point.

## Testing addition

Add regression coverage proving that:

- a Covert unit gaining Guard/Haste/Reflect/etc. does not leak the positive status through opponent log entries;
- refresh/stack/expiry/removal of a hidden positive buff does not leak its identity before Reveal;
- owner and same-team viewers still receive full lifecycle entries;
- successful Sensory Reveal may show the buffs purged at Reveal time;
- past suppressed lifecycle entries do not appear after Reveal or after Covert naturally expires.
