# AUREVANE — Luminous Adventure Visual Experience & Integrated UI Evolution

**Status:** Authoritative visual-experience refinement subordinate to `docs/GAME_MASTER_PLAN.md` and `docs/ART_BIBLE.md`, and complementary to `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/MEDIA_PIPELINE.md`, `docs/BATTLE_INTERFACE.md`, `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`, and `docs/ROADMAP_VISUAL_EXPERIENCE.md`.

**Direction approved:** 2026-08-16.

This document records an important refinement to AUREVANE's intended finished presentation.

The current development shell is useful for building systems, but its dark, restrained visual language must **not** accidentally become the permanent visual identity of the finished game merely because it existed first.

AUREVANE should ultimately feel like a **living fantasy adventure**: inviting, colorful, illustrated, inhabited, tactile, regionally distinctive, and rich with environmental context. Darkness remains an important dramatic tool, but it is not the default emotional state of every screen.

The governing visual principle is:

> **Luminous by default; darkness is earned by context.**

This does not mean a white website, a pastel mobile game, or constant saturation. It means the normal adventure experience should contain daylight, warm and natural values, varied regional color, environmental imagery, character presence, maps, material texture, atmosphere, and visual movement rather than relying primarily on dark navy/charcoal panels.

---

## 1. Emotional North Star

Opening AUREVANE should evoke feelings closer to:

- setting out on an expedition;
- opening a beautifully illustrated fantasy atlas;
- arriving in a living settlement;
- preparing equipment before a dangerous journey;
- standing at the edge of an unfamiliar region;
- seeing companions, weather, landmarks, creatures, banners, markets, roads, ruins, and distant threats;
- watching the world change as time, seasons, events, and story progress alter it.

The normal game should not emotionally read as:

- sitting inside a permanently dark database console;
- navigating a black-and-blue admin dashboard;
- reading disconnected stat cards against an empty void;
- viewing fantasy wallpaper behind generic SaaS panels;
- opening the same dark rectangular container regardless of whether the player is in a forest village, desert outpost, academy, battlefield, market, archive, or guild hall.

AUREVANE is a persistent world. The interface should constantly remind the player that there is a **world behind the numbers**.

---

## 2. Value Direction — Light, Midtone, and Dark

The finished game should use a broad value range instead of making dark values the universal foundation.

### Default adventure state

Normal world-facing surfaces should lean toward:

- warm light neutrals;
- stone, linen, parchment-adjacent, ceramic, plaster, pale wood, weathered metal, and mineral-inspired values;
- middle-value natural materials;
- readable dark ink/graphite/navy text and framing;
- strong but controlled regional accent colors;
- illustrated environments and atmospheric gradients where they belong;
- pockets of deep value for hierarchy rather than entire-screen darkness.

This is **not** permission to coat every screen in fake parchment. The Art Bible's warning against noisy faux-medieval interfaces remains valid.

### Dark contexts remain important

Dark presentation is appropriate when the fiction or activity earns it, such as:

- night travel;
- caves, crypts, underground structures, and hostile interiors;
- horror or corrupted locations;
- Closed Star material;
- Unmoored/possibility distortion;
- dangerous boss transitions;
- stealth or occult Discipline moments;
- modal cinematic emphasis;
- selected PvP/tournament presentation where contrast benefits the event;
- high-focus combat overlays when required for tactical readability.

The key difference is that darkness becomes **meaningful** because the player has also experienced daylight, warmth, color, and openness.

If every screen is dark, a dark dungeon has little visual power.

---

## 3. Color Philosophy — Adventure, Not Neon

AUREVANE should feel colorful without becoming toy-like or visually exhausting.

Use color in layers:

### Natural world color

Regions derive color from believable environmental sources:

- sky and weather;
- vegetation;
- soil and stone;
- architecture;
- textiles;
- painted signs/banners;
- local metals and ceramics;
- water;
- crops and market goods;
- firelight and daylight;
- seasonal changes.

### Cultural color

Settlements and factions gain recognizable palette accents through:

- banners;
- clothing;
- trim;
- roof/material choices;
- ceramics;
- shields;
- signage;
- civic motifs;
- map symbols;
- decorative borders.

### Supernatural color

The Art Bible remains authoritative: magical saturation and glow must carry meaning.

Soulmarks, Confluences, rare equipment, bosses, world events, and major narrative phenomena can exceed normal saturation because they are exceptional.

### UI color

UI semantic colors remain centralized design tokens and accessible.

The final shell should not force every location to live inside one universal dark-blue palette. Instead, UI tokens should support controlled contextual theming while preserving stable semantic meaning.

For example, `danger`, `ally`, `success`, `disabled`, `focus`, and `rarity` remain semantically consistent even when a region changes the surrounding material/accent palette.

---

## 4. Luminous Adventure Palette Families

The exact production palette will be developed through the Art Bible and design tokens rather than frozen here, but the desired family of values includes combinations such as:

- warm ivory / weathered linen;
- sandstone / pale ochre;
- warm stone / limestone;
- parchment-adjacent cream used selectively;
- muted brass / aged gold accents;
- sky and river blues;
- moss / fern / sage greens;
- clay / terracotta / rust accents;
- berry / burgundy / banner reds;
- frost teal and pale mineral blues where regional identity supports them;
- dark ink / deep navy / graphite as anchors rather than universal backgrounds.

Colors should feel like they could belong to a real place before supernatural effects are layered on top.

Avoid defaulting to:

- near-black background + blue glow + gray cards for every screen;
- neon accents with no world source;
- random gradients used only to make panels look modern;
- one global accent color that erases regional identity;
- pure white expanses that feel like a productivity application.

---

## 5. The UI Should Feel Integrated With the World

The UI should not sit on top of AUREVANE like an unrelated operating system.

At the same time, it should not imitate literal medieval objects so aggressively that usability suffers.

The target is **integrated abstraction**.

A location or activity may influence:

- surrounding artwork;
- surface value and material cues;
- borders and motifs;
- background landmarks;
- ambient animation;
- weather;
- local iconography;
- map fragments;
- NPC portraits;
- banners;
- decorative separators;
- music/ambience;
- transition treatment.

But the placement and meaning of common controls should remain learnable.

A button should still look and behave like an AUREVANE button even when a mountain city and coastal port use different environmental framing.

---

## 6. Replace Empty Background With Meaningful World Presence

Large empty dark backgrounds should not become the standard way to make the interface feel premium.

Where appropriate, use purposeful visual context such as:

- region panoramas;
- settlement establishing art;
- distant landmarks;
- local architecture;
- illustrated maps;
- character/NPC portraits;
- equipment silhouettes;
- landscape crops;
- weather layers;
- environmental props;
- subtle crowds or activity silhouettes;
- banners/standards;
- expedition route imagery;
- event-state changes;
- time-of-day variants.

These assets are not decoration for decoration's sake. They answer questions such as:

> Where am I?

> What kind of place is this?

> Who lives here?

> What is happening now?

> What am I preparing to do?

---

## 7. Screen Composition — Art Is Part of the Layout

Important images should be composed **with** the interface, not dropped behind it after the interface is finished.

Examples:

### Character Profile

The character should have visual presence through portrait/full-figure treatment, equipment silhouette, title/prestige presentation, and region/world context.

The profile should not become a spreadsheet of numbers centered inside a dark rectangle.

### Armory / Build

Equipment should feel like equipment.

Use item imagery, silhouette, slot geography, weapon/armor material cues, build identity, Discipline iconography, and visual comparison rather than presenting the Armory as a plain settings form.

### World / Settlement

The current place should dominate composition enough that changing locations visibly changes the screen.

A player should not need to read the town name to know that they left one culture and entered another.

### Quest / Story

Important NPCs and narrative moments should have portrait or scene presence where appropriate. Dialogue should feel connected to a person and place rather than appearing as generic text inside an interchangeable panel.

### Inventory

Use recognizable item art, category shape language, useful material cues, and a clear relationship between inventory and the character/build.

### Archive

The Archive may use more paper/document/ink/material language than ordinary UI because its fiction supports it, while still remaining readable and modern.

### Guild / Social

Identity should come through crests, banners, character portraits, guild history, Chronicle records, and achievements rather than just a member table.

### Economy / Vendors

A vendor should feel like a person/place/service in the world where appropriate, not a generic ecommerce grid.

---

## 8. World-Aware UI Theming

AUREVANE should eventually support a controlled **World-Aware Theme Context**.

This does not mean fully skinning every component per location.

A location/region/activity context may provide approved presentation metadata such as:

```text
region_theme_id
location_theme_id
surface_family
accent_family
background_art_id
landmark_art_id
ambient_layer_id
weather_state
time_of_day_state
ornament_motif_id
banner_or_culture_id
music_context
ambience_context
```

The design system resolves those inputs into safe, accessible presentation tokens.

Important rules:

- gameplay semantics do not change with theme;
- text contrast remains valid;
- theme tokens are bounded and reviewed;
- components do not accept arbitrary colors from content records;
- location theming never obscures navigation or state;
- dark/light contextual surfaces are tested together;
- fallback theme exists when media is missing.

---

## 9. Adventure Shell Versus System Surfaces

Not every screen needs equal environmental immersion.

Use three broad presentation levels.

### World-rich surfaces

High environmental presence:

- world map;
- settlements;
- exploration;
- quest hubs;
- event pages;
- expedition entrances;
- important story scenes.

### Character-rich surfaces

Identity/art-forward but still system dense:

- profile;
- Armory;
- Discipline/Mastery;
- Soulmarks;
- achievements;
- social profile;
- guild identity.

### Utility-rich surfaces

Cleaner and more neutral, but still AUREVANE:

- settings;
- accessibility;
- account security;
- dense configuration;
- support flows;
- selected Master Panel surfaces.

The current early-development shell naturally resembles the third category because foundation work is utility-heavy. That is **not evidence that the whole finished game should look that way**.

---

## 10. Battle Presentation

`docs/BATTLE_INTERFACE.md` remains authoritative for battle composition: the battlefield is the primary canvas.

This visual direction strengthens that rule.

The final combat cockpit should avoid becoming a dark rectangular frame around a colorful board.

Instead:

- battle-scene environment determines much of the screen's atmosphere;
- side rails and Command Deck use readable surfaces that harmonize with the scene;
- compact dark anchoring can improve focus when necessary;
- region/material cues can appear in restrained framing;
- initiative/status semantic colors remain stable;
- VFX and target overlays remain clearer than decorative environment art;
- bright outdoor battles are allowed to feel genuinely bright;
- night/dungeon battles can become genuinely dark because the system is capable of both.

Do not globally dim every battle merely to make VFX look more dramatic.

---

## 11. A Living Screen Should Contain Life

A world can feel dead even with beautiful static paintings.

Where performance and accessibility permit, selected world-facing surfaces should include subtle life:

- cloud movement;
- weather;
- flags;
- smoke from chimneys;
- leaves/grass;
- water;
- lanterns/firelight;
- distant birds;
- market silhouettes;
- moving shadows;
- region-specific ambient particles;
- NPC idle variation;
- event-state changes;
- day/night transitions.

This is ambient support, not constant visual noise.

Avoid making every card float, pulse, breathe, shimmer, or animate independently.

Reduced-motion settings must disable or simplify nonessential motion.

---

## 12. People Matter

AUREVANE should not feel like a landscape database.

Important player-facing systems should use people where fiction supports it:

- mentors;
- merchants;
- quest givers;
- guild representatives;
- rivals;
- expedition contacts;
- nation figures;
- event participants;
- recurring NPCs;
- party members;
- the player's own character.

Portraits and character art create emotional continuity and make settlements/social systems feel inhabited.

Do not add random decorative faces with no identity simply to fill space.

---

## 13. Maps as Adventure Objects

Maps should be major identity surfaces.

The world map, region maps, Expedition maps, travel routes, discovered landmarks, event overlays, and tactical battle maps should share coherent cartographic language while serving different gameplay needs.

A good map should create curiosity:

> What is beyond that ridge?

> Why is that road broken?

> What is that tower symbol?

> What changed in this region?

Maps should use illustration, geography, route/landmark hierarchy, discovery state, and restrained annotation rather than becoming generic node graphs floating in darkness.

---

## 14. Region Identity Test

A mature region should pass a simple visual test:

> If location names and text labels were temporarily hidden, could a player still tell that three screenshots come from three different regions/cultures?

Differences should come from more than hue shifts.

Use:

- architecture;
- vegetation;
- materials;
- terrain;
- weather;
- silhouettes;
- cultural motifs;
- clothing;
- props;
- light quality;
- typography/accent treatment where approved;
- map language;
- ambient sound.

Palette swapping the same settlement does not pass this test.

---

## 15. Activity Identity Test

Likewise, major systems should not all look like the same page with a different heading.

Without harming navigation consistency, Profile, Armory, Archive, Guild, Marketplace, Expedition preparation, World Pulse, and Tactical Hall should each have a recognizable composition and visual focal point tied to their purpose.

Reuse components; do not reuse an identical screen composition everywhere.

---

## 16. Illustrated Information Hierarchy

Art must improve hierarchy rather than fight it.

A page can have a strong illustrated focal area while keeping dense gameplay information compact and legible.

Preferred hierarchy:

1. current place/person/object/action identity;
2. immediate player task;
3. primary gameplay information;
4. secondary contextual information;
5. environmental richness;
6. decorative detail.

If decorative art makes the player work harder to identify the primary action, it is failing.

---

## 17. Density Without Boredom

AUREVANE needs information density because it is a deep RPG.

The answer is not giant empty spacing.

Nor is the answer dozens of identical dark cards.

Use:

- grouped surfaces;
- illustrated anchors;
- compact tables where tables are appropriate;
- icons with meaningful shape language;
- layered detail;
- collapsible secondary information;
- clear section rhythm;
- contextual sidebars;
- visual comparison;
- maps/portraits/item imagery where they answer real questions.

The interface should be **rich**, not cluttered.

---

## 18. Material Language

The UI may borrow from world materials while staying modern.

Potential material cues include:

- pale stone;
- carved or etched separators;
- cloth/banner accents;
- leather used sparingly;
- metal fasteners/trim;
- glass/crystal for supernatural states;
- paper/document surfaces where fiction warrants them;
- ceramic/mineral surfaces in regional contexts;
- luminous magical materials for rare states.

Avoid literal skeuomorphic excess such as making every button look like a heavy carved medieval plaque.

Materials should usually be implied through texture, edge, depth, light, and ornament rather than photorealistic UI furniture.

---

## 19. Typography and Adventure Tone

Typography should help the game feel authored and adventurous without harming readability.

Use expressive display typography for:

- region names;
- major story moments;
- bosses;
- Disciplines;
- chapter/event identity;
- important rewards.

Use highly readable text faces for:

- body copy;
- stats;
- combat details;
- tooltips;
- tables;
- accessibility-critical information.

Do not turn every label into decorative fantasy lettering.

---

## 20. Imagery Should Be Functional

An image earns its bandwidth and screen space by doing one or more jobs:

- establishing place;
- identifying a person;
- identifying an item;
- reinforcing progression/prestige;
- teaching a mechanic;
- communicating rarity;
- setting narrative mood;
- guiding navigation;
- showing change;
- creating anticipation;
- making a reward emotionally meaningful.

Avoid generic filler illustrations whose only purpose is to make a panel less empty.

---

## 21. Progressive Visual Fidelity

The final visual standard must not force every early engineering ticket to become an art-production marathon.

Use progressive fidelity.

### Foundation fidelity

- correct layout;
- design tokens;
- accessibility;
- stable media hooks;
- clean fallbacks;
- enough visual identity to avoid disposable architecture.

### Representative fidelity

When a system enters product validation:

- one or more polished representative screens;
- approved art where player perception matters;
- real environmental context;
- meaningful motion/audio;
- enough quality to judge the intended experience rather than a graybox.

### Production fidelity

Before mature alpha/live:

- broad region/location visual coverage;
- coherent character/item/icon families;
- responsive derivatives;
- animation/ambience polish;
- final accessibility/performance passes;
- no dependence on placeholder dark shell styling.

This keeps the project efficient without letting temporary visuals become permanent by inertia.

---

## 22. Design-System Requirements

The design system should evolve to support this direction without becoming theme spaghetti.

Eventually support reviewed tokens/concepts for:

- base surface values;
- elevated surfaces;
- dark contextual surfaces;
- ink/text hierarchy;
- border/divider families;
- warm/cool material families;
- regional accents;
- semantic colors;
- focus rings;
- rarity/power states;
- ambient background layers;
- contextual illustration slots;
- ornament intensity;
- motion intensity;
- image scrims/readability masks;
- translucent tactical overlays.

Never hard-code `dark navy` as an assumption inside every component.

A component should remain valid when placed on approved light, midtone, or dark contextual surfaces.

---

## 23. Accessibility

A lighter, richer game must remain accessible.

Requirements include:

- sufficient text/icon contrast across every approved theme;
- no important state encoded only by color;
- readable focus states on light and dark contexts;
- optional reduction of ambient animation;
- reduced motion;
- legible text over imagery through intentional composition/scrims rather than random shadow effects;
- sufficient contrast for tactical overlays against bright and dark battlefields;
- no excessive flashing;
- brightness transitions that avoid painful abrupt full-screen changes where practical;
- font sizing/line length appropriate to phones and laptops.

Accessibility review happens **before** a regional theme is approved.

---

## 24. Browser Performance Budget

The desire for life and imagery cannot turn the browser into a slideshow.

Use:

- responsive image derivatives;
- modern image formats;
- lazy loading;
- low-cost ambient animation;
- CSS/transform animation where appropriate;
- bounded particle counts;
- scene-level asset budgets;
- preloading only when transition context justifies it;
- graceful low-fidelity fallbacks;
- animation suspension when offscreen/backgrounded;
- memory-conscious scene transitions;
- mobile-specific asset sizes.

Do not stream multiple full-resolution environment masters merely because a desktop monitor can display them.

---

## 25. World-State Visual Variation

The living-world system should be capable of changing presentation when gameplay state changes.

Examples:

- repaired versus damaged settlement;
- festival/event banners;
- invaded region;
- unusual weather;
- seasonal vegetation;
- merchant arrival;
- aftermath of a world boss;
- Closed Star lockdown;
- Unmoored distortion;
- faction/nation occupation later;
- story-era changes.

Variation should come from content/state metadata, not manual one-off CSS pages.

---

## 26. Reward Presentation

A richer visual world makes rewards more meaningful.

Important rewards should have escalating presentation proportional to significance:

- item icon + concise feedback for normal loot;
- stronger object art/animation/audio for rare acquisition;
- character/build integration for equipment;
- special Confluence/Soulmark unlock treatment;
- region/world visual acknowledgement where an achievement changes the world;
- restrained prestige presentation for titles/Chronicle history.

Do not make every ordinary coin pickup trigger a legendary animation.

---

## 27. Navigation Should Feel Like Travel Through a Game

Browser navigation must remain fast, but transitions between major destinations should preserve a sense of place.

Possible techniques include:

- location headers that transition rather than vanish into unrelated pages;
- short map-route movement;
- environmental audio crossfades;
- scene artwork changes;
- persistent character/world context;
- region-specific loading states when loading is genuinely required;
- contextual breadcrumbs that feel like world geography rather than website hierarchy.

Avoid adding artificial delays only for atmosphere.

---

## 28. The Current Dark Shell Is Not a Commitment

The current Phase 0/1 shell exists because early development required:

- authentication;
- profile flows;
- character creation;
- derived stats;
- responsive foundations;
- media fallbacks;
- error/recovery states.

Those systems naturally reward a restrained implementation shell.

Project rule:

> **Do not use the existence of the early dark shell as evidence that future gameplay surfaces should preserve the same dominant darkness.**

At the same time:

> **Do not stop Phase 1 to perform a cosmetic rewrite that will be replaced once the world, battle scenes, locations, Disciplines, and real production assets exist.**

We evolve deliberately at the roadmap milestones where enough real game context exists to make the redesign informed rather than speculative.

---

## 29. Visual Validation Questions

When a representative gameplay slice is reviewed, ask:

- Does this look like a game or a dashboard?
- Does it feel like a fantasy adventure?
- Can I tell where I am?
- Is there enough life/personality on screen?
- Are images integrated with the task rather than acting as wallpaper?
- Does the screen remain readable without flattening everything into dark rectangles?
- Would changing regions materially change the experience?
- Are the important controls still obvious?
- Does the UI remain coherent across bright and dark contexts?
- Is the screen visually rich without becoming busy?
- Does it remain performant on a common laptop and representative phone?
- Is this recognizably AUREVANE rather than generic fantasy UI?

---

## 30. Visual Acceptance Tests for Mature Alpha

Before mature Closed Alpha, representative player-facing surfaces should demonstrate all of the following:

1. **Value range:** the game is capable of convincing bright/daylight, midtone, and dark contexts rather than one universal dark shell.
2. **Regional distinction:** multiple regions are visually distinguishable without relying only on labels or palette swaps.
3. **Integrated imagery:** world, character, item, and environmental art are meaningfully incorporated into major gameplay surfaces.
4. **Activity identity:** major systems do not all look like the same card grid with a different heading.
5. **Living-world state:** at least selected location/event states visibly change based on world conditions.
6. **Battle integration:** the combat cockpit harmonizes with its battle scene without sacrificing tactical readability.
7. **Responsive fidelity:** phone/laptop layouts retain identity rather than stripping down to a generic black list of cards.
8. **Accessibility:** bright/dark contextual themes preserve contrast, focus, color-independent state, and reduced-motion support.
9. **Performance:** representative rich screens meet agreed browser performance budgets on target hardware.
10. **Player perception:** representative testers describe the experience as game-like, adventurous, atmospheric, and alive rather than primarily as dark, empty, dashboard-like, or generic.

---

## 31. Anti-Patterns

Reject the following as default visual solutions:

- giant dark page with a handful of floating cards;
- identical navy cards on every gameplay screen;
- generic fantasy background blurred behind a SaaS layout;
- extreme glassmorphism;
- excessive glow around ordinary controls;
- unnecessary gradients;
- fake parchment everywhere;
- brown-on-brown medieval skeuomorphism;
- random artwork added only to fill blank space;
- every region using the same composition with a hue shift;
- text placed directly over busy artwork without composition planning;
- massive hero images that force essential gameplay below the fold;
- ambient animations that compete with tactical information;
- visual themes that break semantic colors or accessibility;
- hard-coded dark assumptions inside reusable components;
- waiting until Phase 14 to discover that the entire game architecture only works against black backgrounds.

---

## 32. Definition of Success

This visual direction succeeds when AUREVANE can show a sequence such as:

```text
sunlit coastal settlement
        ↓
illustrated regional map
        ↓
character / Armory preparation
        ↓
bright windswept road encounter
        ↓
warm guild hall
        ↓
storm-darkened Expedition entrance
        ↓
ominous underground battle
        ↓
return to a changed town after victory
```

—and every step feels like the same game while possessing its own place, mood, color, people, imagery, and purpose.

The player should feel that they are **moving through AUREVANE**, not opening different pages of the same dark application.
