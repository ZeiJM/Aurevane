# Master elevation chances

The Owner requested independent raised tile heights 1/2/3 at 60%/30%/10%, and editable percentages in the Master Panel. This completes that original request within the existing Owner-only combat settings flow.

Store an append-only elevation policy separately from effect timing. The three chances are integer basis points from 0 through 10000, totaling exactly 10000; the initial policy is version 1 with 6000/3000/1000. Accept exact percentage inputs to two decimal places. Reject unknown keys, invalid versions, non-integers, negative values and wrong totals. Zero and 100% are valid.

Use one seeded independent draw per raised tile. Preserve flat ground, spawn clearance, tile placement, terrain, connected ground and combat RNG. Probability means chance per tile, not a guaranteed board quota. Every new Battle Hall and PvP encounter reads the current policy before tile generation and pins it alongside the generated tiles. Saved battles retain their actual tiles and policy; reads, previews, moves and reloads never reroll. Historical snapshots need no repair.

Expose the three labeled percentages and their total beside Effect Timing in the existing Owner-only Master page. Publishing requires a reason, authenticated staff capability and database Game Owner authority. Serialize publication with an advisory transaction lock and expected-version check. Record actor, reason and timestamp per version. The table and RPCs are inaccessible to anonymous/authenticated clients; only server service role can call the narrowly scoped functions. Missing migration may read defaults for deployment compatibility, but publishing must fail rather than pretend to save.

Verify deterministic 0/100% extremes, fractional percentages, invalid input, default distribution, persistence failures, stale versions, Owner authorization, actual authenticated Master publish/reload/restore, and old/new battle pinning. Preserve existing targeting and percentage DoT behavior.
