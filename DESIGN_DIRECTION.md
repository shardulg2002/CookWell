# CookWell experience direction

Reference confirmed by the owner on 14 September 2026:
[mise - meal planner by TEGS LABS LTD](https://apps.apple.com/us/app/mise-meal-planner/id6777471316).
This is not one of the other unrelated products called Mise.

## Evidence and limits

The official listing and its public screenshots were reviewed, not an installed or subscribed account. The screenshots show a compact weekly meal list beside a spending summary and grocery shortcut, food-led recipe pages with per-serving macros, cuisine discovery tiles, and simple preference controls. The listing describes personalised plans based on budget, calorie goals, supermarkets and existing ingredients.

The listing is not evidence that CookWell can access Mise's data or that any displayed supermarket prices are live or available through an API. Do not infer undocumented native-app behaviour from promotional screenshots. Use original CookWell branding, content and appropriately licensed or original imagery, not copied Mise assets.

## Product direction

Use the reference for the simplicity of the meal-planning experience, while retaining CookWell's more detailed requirements. A first-time solo cook should immediately understand what to eat, what to buy, and what to prepare next. Rich nutrition information remains accessible, but should not push these actions far down the page.

### Today

- Lead with one contextual next action: shop, cook a batch, assemble something fresh, or reheat an existing portion.
- Show breakfast, lunch, snack and dinner as compact meal cards with clear Cook / Reheat / Eating out states and direct change controls.
- Keep actual calorie and macro progress in a compact, explicitly labelled summary. Do not count planned meals as eaten.
- Put detailed comparisons and non-urgent reminders behind disclosure controls or on Progress.

### Weekly plan

- One week selector and seven selectable days with Shop / Cook / Reheat badges.
- A compact summary of full-pack spending, daily nutrition coverage and cooking sessions. Important gaps remain visible without opening a report.
- Selecting a day shows its four meals and next action. Avoid presenting four separate long versions of the same schedule.
- Swaps should preview changes to full-pack cost, daily nutrients and batch portions before confirmation.
- Expose the existing detailed seven-day nutrient report on demand; retain the non-destructive rebalance preview.

### Recipe and cook mode

- Food-led recipe detail with an honest image, title, time and per-serving nutrition. Illustrative images must be labelled; missing images must not block recipes.
- One prominent state-aware action: Cook N portions, Mix one serving, or Reheat a prepared portion.
- Separate quantities for the whole batch from nutrition for one serving. Finished cooked weight gives grams per serving, not an estimate from raw weight.
- Preserve the existing precise gram/ml instructions, single-action steps, timers, equipment-aware multitasking, cooling and storage checks.
- Keep Like / Dislike easy to reach. Dislike excludes future generated plans; liking is a preference signal, not a fixed cuisine rule.

### Shopping and kitchen

- Separate a focused Buy checklist from My kitchen inventory within one area.
- Show the next trip, required full packs, price provenance and stock already available.
- Review and confirm purchases before increasing inventory; keep purchase cost distinct from ingredient cost consumed.
- Inventory retains quantity, expiry, prepared portions, freezer state, corrections and waste.

### Progress and preferences

- Progress contains the full diary, nutrient comparisons, weight milestones and glucose/activity trends.
- Preferences remain accessible from the profile control; the primary mobile navigation should not need a separate sixth Settings tab.
- Onboarding remains editable and collects appliances, cooking/shopping cadence, budget, dietary exclusions, discovery preferences and health-related target inputs. No hardcoded cuisine identity or assumed medical answers.

## Requirements that remain non-negotiable

- All four daily meal slots, individual changes and eating-out options.
- Planning towards the chosen nutrient targets and weekly budget together, with explicit warnings when constraints cannot be met.
- Optional shakes only when compatible with the user's choices, equipment and budget.
- Cooking every two or three days as an editable preference, with recipe occurrences determining servings and safe storage.
- Stock-aware shopping and next-week drafts; purchases, cooking and eating are separate confirmed transactions.
- Diabetes-aware planning and tracking without food-as-treatment promises or medication advice.
- Saved profile and account isolation, existing cooked-food snapshots and historical records survive UI changes.
- No paid service, live retailer-feed claim, native Apple Health promise or added subscription without a separate implementation and cost decision.

## Implementation order

1. Restructure Today and the weekly plan around meals and their next actions, preserving the existing backend.
2. Make recipe entry state-aware and clarify batch versus serving quantities.
3. Add informative swap previews and a focused shopping checklist.
4. Integrate original/appropriately licensed recipe imagery with useful fallbacks, then polish onboarding and mobile navigation.
5. Test new-user and returning-user journeys, keyboard/mobile layouts, and purchase → cook → eat → rollover regressions before publication.

## Implemented adaptation — 26 September 2026

Today and Plan now use the focused meal layout; detailed reports and cooking sessions expand on demand. Mobile navigation has five destinations with profile settings. Recipe details separate whole-batch ingredients from per-serving macros, show ingredient/instruction tabs, and handle saved, frozen, expired and eaten portions without another raw-ingredient cooking task. Swaps have authenticated, revision-checked previews before confirmation. Buy and My kitchen are separate; reviewed multi-item purchases require actual paid amounts and explicit confirmation. Three original labelled AI recipe illustrations are included, with neutral fallbacks elsewhere; see RECIPE_ASSETS.md.

No paid runtime service, copied Mise assets, native integration or live-price-feed claim was introduced. Existing plans are not silently replaced by the new nutrition settings or interface. Publication and verification results are recorded in IMPLEMENTATION_NOTES.md.
