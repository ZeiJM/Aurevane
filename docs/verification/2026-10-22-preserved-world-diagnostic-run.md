# Preserved World diagnostic run — 2026-10-22

Master Panel completion remains the owner's current priority. This receipt preserves the already-running diagnostic job; it does not authorize or claim a map release.

PR #970 exact head `270d391fc45d8c5aa7b26ce2f4660839bde4a42f`, tree `6902706f7bfaeefe8fcf655dcd62e1a26faadbb4`.
Run `39842544592`, job `120047128104` completed successfully.
Actual command retained `--project=desktop-chromium --workers=1 --repeat-each=20 --retries=0` and the two named presence/WASD cases.
Log result: **40 passed (12.9m)**. The existing strict assertions were unchanged.
Artifact: `world-timing-repeat-evidence`, ID `12455415174`, archive SHA256 `d1be213f7ddca594c00667dfba0b0d40b4030acce7f0b8da554b44c94e645f90`, 331302 bytes /180 files.
Artifact URL: https://github.com/ZeiJM/Aurevane/actions/runs/39842544592/artifacts/12455415174

Related CI `39842544285` also passed quality, production dependency audit, native database reconstruction, Staff/Players/event authority and native catalogue concurrency.
This does not erase the previous PR #960 strict-repeat failure (36/40), and one passing diagnostic run does not establish a general stability guarantee.
PRs #933/#960/#970 remain unmerged pending later complete evidence review. Profiling serialization itself contributes some main-thread work; account for that when interpreting observations.
