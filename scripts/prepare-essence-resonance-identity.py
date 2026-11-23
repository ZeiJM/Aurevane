"""Derive the identity-restoration candidate locally; never connects to a database."""

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "docs/superpowers/specs/2026-10-18-modular-correction-cohort.json"
DESIGNS = ROOT / "docs/superpowers/specs/2026-10-19-essence-resonance-designs.json"
OUTPUT = ROOT / "docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json"


def digest(value):
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(canonical.encode()).hexdigest()


def candidate():
    baseline = json.loads(BASE.read_text())
    designs = json.loads(DESIGNS.read_text())["records"]
    current = {
        row["id"]: row for row in baseline["records"]
        if row["kind"] in ("essence", "resonance")
    }
    assert len(designs) == len({row["id"] for row in designs}) == len(current) == 153
    assert {row["id"] for row in designs} == set(current)
    records = []
    review = []
    for design in designs:
        original = current[design["id"]]
        before = original["after"]
        keep = design["keepOrRevise"] == "keep"
        review.append({
            "id": design["id"], "kind": original["kind"],
            "decision": "retained" if keep else "revised",
            "rationale": design.get("rationale", design.get("whyBothDisciplines")),
        })
        if keep:
            assert design["canonicalAbility"] == before["ability"], design["id"]
            continue
        after = deepcopy(before)
        after["contentVersion"] += 1
        after["ability"] = deepcopy(design["canonicalAbility"])
        after["description"] = design.get(
            "proposedDescription", design.get("description", design.get("oneSentenceIdentity"))
        )
        assert after["description"] and len(after["description"]) <= 300, design["id"]
        if design.get("name"):
            after["name"] = design["name"]
        after["authoring"]["validationTags"].append("owner-identity-restoration-20261019")
        if original["kind"] == "essence":
            after["skill"]["contentVersion"] = after["contentVersion"]
            after["skill"]["descriptionRef"] = after["description"]
            first = after["ability"]["behaviors"][0]
            costs = {cost["resource"]: cost["amount"] for cost in first["costs"]}
            after["skill"]["apCost"] = costs.get("ap", 0)
            after["skill"]["mpCost"] = costs.get("mp", 0)
            after["skill"]["target"] = deepcopy(first["targeting"])
            after["skill"]["cooldown"] = deepcopy(first["cooldown"])
            after["skill"]["authoring"]["validationTags"].append(
                "owner-identity-restoration-20261019"
            )
        records.append({
            "kind": original["kind"], "id": original["id"],
            "beforeVersion": before["contentVersion"], "beforeDigest": digest(before),
            "after": after,
        })
    return {
        "schemaVersion": 1, "status": "candidate-not-published-pending-full-acceptance",
        "reviewedRecordCount": 153, "requiredRecordCount": len(records),
        "previousManifestSha256": sha256(BASE.read_bytes()).hexdigest(),
        "designManifestSha256": sha256(DESIGNS.read_bytes()).hexdigest(),
        "globalTimingPolicyVersion": 8, "ordinarySkillsAndBasicsUnchanged": True,
        "review": review, "records": records,
    }


if __name__ == "__main__":
    result = candidate()
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({
        "records": len(result["records"]), "reviewed": result["reviewedRecordCount"],
        "output": str(OUTPUT.relative_to(ROOT)), "sha256": sha256(OUTPUT.read_bytes()).hexdigest(),
    }))
