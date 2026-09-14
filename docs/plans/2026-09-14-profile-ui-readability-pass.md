# AUREVANE Profile UI Readability Pass

## Scope

Implement the approved 100%-zoom UI cleanup without changing authoritative gameplay behavior.

1. Stabilize shared header/footer geometry across authenticated, account, and public reference pages; preserve a stable scrollbar gutter.
2. Increase active Passive Training status-strip readability while keeping it compact.
3. Simplify and rebalance Character Profile: left identity card, main stats, build identity, Combat Loadout, Techniques, Resonance/Essence.
4. Remove Pronouns from Profile and character creation presentation; replace the Profile fact with the live build type.
5. Make primary rail icons brass/gold and preserve readable fit at normal desktop viewports.
6. Add/update regression coverage for requested copy, controls, shell geometry, and 100%-zoom desktop fit.
7. Run CI, Desktop page fit, Desktop experience, and Browser smoke; merge only when all are green.
8. After merge, perform one authorized production deployment, verify production, and relock Vercel Git deployments.
