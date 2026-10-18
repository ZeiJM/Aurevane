"""Prepare the reviewed correction candidate; never connects to or publishes a database."""

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json"
DESTINATION = ROOT / "docs/superpowers/specs/2026-10-18-modular-correction-cohort.json"

# Deliberate ranged/formation exceptions. All other independently aimed Skills use zero.
ELEVATION = {
    "farstrider.aimed-shot": 1,
    "farstrider.longshot": 3,
    "farstrider.piercing-barrage": 1,
    "aetherist.arc-bolt": 1,
    "aetherist.chain-spark": 1,
    "lifebinder.mending-light": 1,
    "wildwarden.thorn-line": 1,
    "stormsinger.lightning-line": 2,
    "essence.farstrider.deadeye-barrage": 2,
    "resonance.edgedancer-ironfist.linked-sequence": 3,
    "resonance.farstrider-frostweaver.linked-sequence": 1,
    "resonance.farstrider-stormsinger.linked-sequence": 2,
    "resonance.frostweaver-stormsinger.linked-sequence": 1,
    "resonance.chronist-farstrider.linked-sequence": 1,
}


def digest(value):
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(canonical.encode()).hexdigest()


def revise_payload(payload, ground_move=False):
    if payload.get("type") == "barrier-change":
        payload["basis"] = "maximum-hp-percent"
    if payload.get("type") == "apply-status":
        payload["stacks"] = 1
        if payload.get("statusId") == "blindside":
            payload.update(statusId="blindside-vulnerability", recipient="primary-unit", durationTurns=1)
    if ground_move and payload.get("recipient") == "primary-unit":
        payload["recipient"] = "affected-units"


def revise_envelope(value):
    if isinstance(value, list):
        for entry in value:
            revise_envelope(entry)
    elif isinstance(value, dict):
        # Neither native compatibility envelopes nor canonical packets override Master timing.
        value.pop("timing", None)
        if "activationLimits" in value:
            value["activationLimits"] = [limit for limit in value["activationLimits"] if limit != "once-per-battle"]
        if "type" in value:
            revise_payload(value)
        for entry in value.values():
            revise_envelope(entry)


STATUS_VERBS = {
    "guarded": "gain Guard",
    "fortified": "fortify yourself",
    "reckless": "fight recklessly",
    "haste": "gain Haste",
    "inspired": "gain Damage Up",
    "invisible": "become Invisible",
    "covert": "become Covert",
    "airborne": "become Airborne",
    "warded": "gain Burn Ward",
    "exposed": "make the enemy Vulnerable",
    "hexed": "reduce the enemy’s healing",
    "suppress": "weaken the enemy’s attacks",
    "slow": "slow the enemy",
    "root": "root the enemy",
    "challenged": "taunt the enemy",
    "mark": "mark the enemy",
    "blind": "reduce the enemy’s Accuracy",
    "frozen": "chill the enemy",
    "wet": "drench the enemy",
    "conductive": "apply Conductive",
    "blindside-vulnerability": "expose the enemy to attacks from the side or rear",
}


def phrase(effect, behavior):
    payload = effect["payload"]
    kind = payload["type"]
    if kind in ("damage", "pierce"):
        if effect.get("requirements"):
            return None  # Its exact prerequisite and additional power are in Effects.
        target = behavior.get("targeting") or {}
        shape = target.get("shape", {}).get("kind")
        enemy = "enemies along a line" if shape == "line" else "nearby enemies" if shape == "circle" else "chosen enemies" if target.get("maximumSelections", 1) > 1 else "the enemy"
        return f"strike {enemy}" if kind == "damage" else f"deliver a piercing strike against {enemy}"
    if kind == "move":
        return "advance"
    if kind == "apply-status":
        text = STATUS_VERBS[payload["statusId"]]
        if payload["recipient"] != "actor" and payload["statusId"] in ("guarded", "fortified", "haste", "inspired", "warded", "airborne", "invisible"):
            return {"guarded": "grant Guard", "fortified": "grant Fortified", "haste": "grant Haste", "inspired": "grant Damage Up", "warded": "grant Burn Ward", "airborne": "grant Airborne", "invisible": "grant Invisible"}[payload["statusId"]]
        return text
    if kind == "barrier-change":
        return "gain a Barrier" if payload["recipient"] == "actor" else "grant a Barrier"
    if kind in ("percentage-recovery", "healing"):
        return "restore MP" if payload.get("resource") == "mp" else "restore HP"
    if kind == "resource-change":
        return "drain enemy MP" if payload["delta"] < 0 else "restore MP"
    if kind in ("poison", "burn", "bleed"):
        return {"poison": "poison enemies", "burn": "burn enemies", "bleed": "cause Bleed"}[kind]
    if kind == "displace":
        return "pull the enemy closer" if payload["direction"] == "pull" else "push the enemy away"
    if kind == "remove-status":
        if payload.get("removalMode") == "specified":
            return "remove the named effects"
        if "poison" in payload["statusIds"]:
            return "remove common debuffs"
        if payload["statusIds"] == ["frozen"]:
            return "remove Chilled from yourself"
        return "remove the named protections"
    if kind == "copy-statuses":
        return "copy eligible buffs" if payload["mode"] == "amplify" else "copy your debuffs to the enemy"
    if kind == "sensory":
        return "reveal a Covert enemy"
    if kind == "return-to-turn-start":
        return "return to your earlier position"
    if kind == "summon":
        return "summon an allied companion"
    if kind == "damage-bonus":
        return "strengthen your attacks" if behavior["activation"] == "ongoing" else "strengthen the chosen attack"
    if kind == "create-terrain":
        return "create Frozen Ground"
    raise ValueError(f"Missing natural description for {kind}")


def sentence(behavior):
    phrases = []
    for effect in behavior["effects"]:
        if effect.get("requirements"):
            continue
        text = phrase(effect, behavior)
        if text and text not in phrases:
            phrases.append(text)
    if not phrases:
        raise ValueError(f"No overview for {behavior['id']}")
    if len(phrases) == 1:
        text = phrases[0]
    elif len(phrases) == 2:
        text = " and ".join(phrases)
    else:
        text = ", ".join(phrases[:-1]) + ", and " + phrases[-1]
    if behavior.get("groundArea"):
        if any(effect["payload"]["type"] == "poison" for effect in behavior["effects"]):
            text = "create a field that damages and poisons enemies"
        elif any(effect["payload"]["type"] == "burn" for effect in behavior["effects"]):
            text = "create a field of embers that damages and burns enemies"
        else:
            text = "create Frozen Ground that slows and chills enemies"
    return text[0].upper() + text[1:] + "."


def revise(row):
    before = row["after"]
    after = deepcopy(before)
    revise_envelope(after)
    after["contentVersion"] += 1
    if row["kind"] == "essence":
        after["skill"]["contentVersion"] += 1
    for behavior in after["ability"]["behaviors"]:
        targeting = behavior["targeting"]
        moving = any(effect["payload"]["type"] == "move" for effect in behavior["effects"])
        if targeting and targeting["kind"] != "self":
            targeting["maximumElevationDifference"] = ELEVATION.get(row["id"], 0)
        if moving:
            targeting.update(geometryVersion=3, kind="ground-tile", categories=["ground"], minimumRange=0)
            for effect in behavior["effects"]:
                revise_payload(effect["payload"], ground_move=True)
        if row["id"] == "vanguard.second-wind":
            behavior["cooldown"] = {"key": "vanguard.second-wind", "ownerTurns": 3}
    overview = " ".join(sentence(behavior) for behavior in after["ability"]["behaviors"])
    for container in [after, *([after["skill"]] if row["kind"] == "essence" else [])]:
        key = "descriptionRef" if "descriptionRef" in container else "description"
        container[key] = overview
        if "effectDescriptions" in container:
            container["effectDescriptions"] = [None] * len(container["effects"])
        if "target" in container and after["ability"]["behaviors"][0]["targeting"]:
            container["target"] = deepcopy(after["ability"]["behaviors"][0]["targeting"])
    return {
        "kind": row["kind"], "id": row["id"], "beforeVersion": before["contentVersion"],
        "beforeDigest": digest(before), "after": after,
        "retainedDesignReference": f"2026-10-10-roster-rebalance-proposals.json#{row['id']}",
        **({"elevationRationale": "Uncommon ranged or elevated formation access; Jump still governs movement."} if row["id"] in ELEVATION else {}),
    }


if __name__ == "__main__":
    source = json.loads(SOURCE.read_text())
    cohort = {
        "schemaVersion": 1,
        "status": "candidate-not-published-pending-full-acceptance",
        "requiredRecordCount": 294,
        "previousManifestSha256": sha256(SOURCE.read_bytes()).hexdigest(),
        "timingChanges": {
            "tagAuthority": "global",
            "modes": {
                "barrier-change": "instant",
                "blindside": "instant",
                "return-to-turn-start": "controlled",
            },
        },
        "records": [revise(row) for row in source["records"]],
    }
    DESTINATION.write_text(json.dumps(cohort, indent=2, ensure_ascii=False) + "\n")
    print(f"Prepared {len(cohort['records'])} correction candidates; no database writes.")
