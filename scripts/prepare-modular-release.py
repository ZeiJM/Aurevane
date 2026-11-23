"""Bind reviewed release SQL locally. Never connects to or mutates a database."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("mode", choices=["publication", "rollback", "readback"])
parser.add_argument("--actor")
parser.add_argument("--token")
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
old_path = ROOT / "docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json"
new_path = ROOT / "docs/superpowers/specs/2026-10-18-modular-correction-cohort.json"
previous = json.loads(old_path.read_text())
candidate = json.loads(new_path.read_text())
assert hashlib.sha256(old_path.read_bytes()).hexdigest() == candidate["previousManifestSha256"]
old = {row["id"]: row for row in previous["records"]}
rows = []
for row in candidate["records"]:
    before = None if row["kind"] == "basic" else old[row["id"]]["after"]
    assert row["after"]["contentVersion"] == row["beforeVersion"] + 1
    if before is not None:
        canonical = json.dumps(before, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        assert hashlib.sha256(canonical.encode()).hexdigest() == row["beforeDigest"]
    rows.append({**row, "kind": "skill" if row["kind"] == "basic" else row["kind"], "before": before})
assert len(rows) == len({row["id"] for row in rows}) == 294
cohort = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
assert "$modular_cohort$" not in cohort
sql = (ROOT / f"docs/verification/release-assets/2026-10-18-modular-{args.mode}.sql").read_text()
if args.mode != "readback":
    if not args.actor or not args.token or not re.fullmatch(r"[a-f0-9]{32}", args.token):
        parser.error("publication/rollback require an Owner UUID and fresh 32-character catalogue token")
    actor = str(uuid.UUID(args.actor))
    sql = sql.replace("__OWNER_ACTOR_UUID__", actor).replace("__EXPECTED_CATALOGUE_TOKEN__", args.token)
sql = sql.replace("__COHORT_JSON__", cohort)
assert not re.search(r"__[A-Z_]+__", sql)
args.output.write_text(sql)
print(json.dumps({"mode": args.mode, "records": len(rows), "bytes": len(sql.encode()), "sha256": hashlib.sha256(sql.encode()).hexdigest(), "cohortSha256": hashlib.sha256(new_path.read_bytes()).hexdigest()}))
