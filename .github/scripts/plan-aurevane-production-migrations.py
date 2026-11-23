"""Read-only PR1040 production planner; shares the exact guarded apply inventory."""

from pathlib import Path
from runpy import run_path


if __name__ == "__main__":
    release = run_path(str(Path(__file__).with_name("apply-aurevane-world-map-geometry.py")))
    release["main"](force_dry_run=True)
