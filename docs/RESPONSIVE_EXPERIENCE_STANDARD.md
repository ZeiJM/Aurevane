# AUREVANE — Responsive Experience Standard

**Status:** Permanent player-facing implementation standard subordinate to the Game Master Plan, Art Bible, Product Experience specification, Accessibility requirements, and Engineering Execution Standard.

AUREVANE is a browser RPG, not a desktop-only site. Every player-facing surface must be deliberately usable on phones, common laptops, and larger desktop displays. Responsiveness is part of feature correctness, not a later polish pass.

## Layout strategy

Prefer responsive CSS, container-aware composition, intrinsic sizing, and dynamic viewport units over user-agent or device-model sniffing. Layout should react to the space actually available.

Width and height both matter. A 1366×768 laptop can require a different density decision from a 1440×900 desktop even when both use a desktop pointer model.

Use safe-area insets where fixed or edge-adjacent controls can collide with phone notches or browser chrome.

Do not create horizontal page overflow at supported viewports. Large display typography must remain fully visible rather than relying on clipping as decoration unless clipping is an intentional reviewed art treatment.

## Interactive controls and mobile keyboards

Interactive fields must remain genuinely focusable and enabled when the feature is available. A disabled feature should render a clear unavailable state rather than look like a broken form.

For phone forms:

- use correct input types, autocomplete, input mode, and enter-key hints;
- avoid layout locks that prevent the focused field from being scrolled above a virtual keyboard;
- use at least 16px input text where needed to avoid unwanted mobile-browser zoom behavior;
- keep touch targets comfortably usable;
- never depend on hover for required actions or explanations.

Automated browser tests cannot prove that a physical software keyboard visibly opened, but they must prove that the intended mobile input is enabled and receives focus. Real-device review should be used when a ticket materially changes a keyboard-heavy flow.

## Popovers, menus, and disclosure panels

Transient utility panels must not unexpectedly reflow unrelated primary content. Opening audio/settings/help must not shove a hero, map, battle board, or primary action to a different position unless the disclosure is intentionally part of that flow.

Non-modal utility panels should support natural dismissal:

- clicking/tapping outside;
- Escape on keyboard;
- an explicit close action where useful;
- focus restoration to the trigger after Escape or explicit close.

Panels must remain within the usable viewport and become internally scrollable when necessary.

## Baseline verification matrix

Player-facing tickets should verify the smallest relevant set from this baseline:

- compact phone around 360–412 CSS px wide;
- modern phone portrait around 390–430×800–930;
- common laptop around 1366×768;
- desktop around 1440×900 or larger.

Add landscape/tablet/small-height cases when the feature makes them material.

Browser acceptance should cover, where applicable:

- no horizontal overflow;
- primary title/action fully visible;
- keyboard focus reaches interactive controls;
- phone form inputs can receive focus;
- overlays stay in bounds and dismiss naturally;
- opening secondary disclosures does not move unrelated primary content;
- reduced-motion behavior remains valid;
- media fallbacks/crops remain readable.

## Ongoing rule

Every future player-facing ticket must consider phone width, laptop height, desktop scale, touch, keyboard, and overlay behavior during implementation—not after the feature is declared complete.
