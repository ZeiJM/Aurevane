# Seal effect — approved design

Owner approved November 4, 2026; separate branch and PR, tracked by #1012.

Seal is an ordinary negative status that prevents new activations of discipline skills in a nonempty authored selection of Attack, Recovery and Utility (all seven combinations). Essence, Resonance, Support, Severance, Ascension, Basic Attack, Move and equipment actions remain usable. Authoritative source identity and the selected behavior's authored classification decide eligibility; effect damage/healing does not override a canonical category.

Use the existing status lifecycle with editable 1–99 Turns (default 2), standard resistance, Cleanse/Conditional Cleanse, and Copy Debuffs behavior. Captured application metadata preserves selected categories. Reapplications use the existing shared status lifetime and union the categories of retained applications. Pending applications do not block before activation. Existing effects, ongoing modifiers and already committed delayed packets continue. New manual/automatic activations and manual discipline modifiers respect Seal. Rejected actions spend no costs, cooldown or usage allowance. Shared previews, editor, status information and Chronicle name the categories clearly.

Approach: extend the existing typed status tuning with `sealedCategories`, rather than introduce a second restriction timer. Enforce canonical participants before commit and retained native discipline actions at ordinary legality. No changes to existing definitions/history or unrelated combat rules.

No deployment, hosted migration, publication, Owner draft or inventory mutation is authorized. An additive identity/timing registration migration is source-only until an explicit release instruction.
