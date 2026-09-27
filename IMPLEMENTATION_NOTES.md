# Implementation notes — 12 September 2026

## Main-meal mix correction — 27 September 2026

- Added an explicit meat/fish frequency preference: unrestricted, about half, or most main meals with some meat-free variety. Omnivore/pescatarian planning can use it; vegetarian/vegan restrictions remain authoritative. Eggs and dairy do not count as meat/fish.
- The nutrition optimiser previously had no meat/fish frequency objective and its shortlist strongly favoured cheap macro-matching menus. Explicit mix choices now retain mixed and meat/fish seed menus and score deviations from the requested range. Unmet preferences produce a warning alongside budget/nutrition warnings, not a guarantee of feasibility.
- “Most” aims for 60–80% of planned lunches/dinners (9–12 of 14); “half” uses 40–60% rounded outward. These are preference ranges, not health recommendations. Saving changes future generation/rebalancing, not historical or already-prepared food.
- Compatible meat/fish recipes appear first in the library, and cards distinguish meat/fish from meat-free recipes. This change uses existing structured recipes; it does not add unverified pressure-cooker methods or silently change health targets.

## Kitchen settings and safe plan dates — 27 September 2026

- Settings now includes a dedicated equipment editor. Its narrow mutation preserves nutrition/health goals and stored food; unprepared batches regroup for storage capabilities, and incompatible future meals are listed in Settings and Plan rather than silently replaced.
- Plan dates offers either moving an unused week or creating a new non-overlapping dated draft. Moves reject purchases, prepared/eaten/skipped meals and reviews. Both choices require confirmation; past start dates and overlaps with other saved weeks are rejected. Moved plans retain meal identifiers, update cooking dates and return to draft for stock review.
- The original first-week date is read-only during repeat onboarding. The backend rejects attempts to silently change it through the profile form and directs the user to Plan dates.
- Added domain/UI regressions and extended the isolated authenticated purchase → cook → partial eating → next-week review/persistence journey to include equipment changes and safe/blocked date moves. No pantry expansion or changes to the owner's records were made.

## Macro-aware planning follow-up

- Added shared server/browser target calculations, transparent methodology, editable nutrition settings, daily plan comparisons and actual intake progress. The user's answers informed the configurable options; new accounts do not inherit an assumed kidney-health answer or fixed cuisine identity.
- New weekly menus are assessed against all six nutrient targets and actual full-pack grocery requirements, including earlier-plan stock reservations and recorded purchases. Deterministic whole-day proposals avoid single-meal search traps; cooking-block refinements retain practical repeated portions. This is a heuristic, not a promise of perfect targets for every constraint set.
- Rebalancing is previewed on a cloned account state before explicit confirmation. Stale revisions are rejected; cooked/eaten meals and inventory are not rewritten. Past dates remain historical, so their gaps may persist in a current-week report.
- Added direct reversible likes/dislikes, expanded equipment choices and an at-a-glance shopping/cooking schedule linking to dated grocery lists. Fresh shake assemblies are shown separately from batch sessions, while dry powder is included in pack costs and stock accounting.
- Added four protein/fibre-rich recipes plus a measured whey/water shake. Every new ingredient is used in scaled instructions. Whey has estimated label values/pricing and a milk allergen; mixing, freezing and yield guards prevent multi-day shake batches.
- No medical target or glucose response is inferred from a finger-prick reading. The moderate-carbohydrate split and higher-protein option are editable planning suggestions; clinical diet review remains necessary. Restricted protein requires custom clinician advice and has no tolerance above the entered amount.
- Existing-account adoption: Settings → Edit nutrition targets, save the chosen approach and answers, then Plan → Preview a better-balanced week. Saving targets alone intentionally does not replace an existing week.

## In-app action centre

- Today now consolidates overdue or due cooking sessions, shopping trips, expiring raw and cooked food, weekly reviews and an optional health check-in.
- Items are ordered by urgency and link directly to the existing workflow. The list is derived from current account state, so completing an action removes it without a separate reminder database.
- This is an in-app queue, not push notification infrastructure; it only updates when CookWell is opened.

## Underlying use case

Help a first-time solo cook in the UK make affordable meals, build confidence, waste less food, and understand their own eating and health trends. The app should reduce daily decisions, not turn meals into a clinical score or force a fixed cuisine identity.

The original prompt and PRODUCT_MVP.md remain the starting point. Current decisions:

- Private account for the first user; isolated accounts provide a later expansion path.
- Website and iPhone home-screen support; no native HealthKit promise.
- No paid external service without a separate cost decision.
- Food likes are soft signals. Exclusions and equipment are hard constraints. Ratings affect later generation. No Thai/Italian-only default.
- Four meal slots every day, including snacks.
- Actual stock and actual eaten food are separate from planned consumption.
- Precise recipe quantities do not make nutrition clinically exact. Brand labels and actual portions still matter.
- BMI is a reference calculation, not a single ideal-weight prescription. A first milestone can be edited; low-BMI weight-loss plans are rejected.

## Verification

The automated suite covers the original workflows plus custom batch yields, split-lot reservations, fractional eating/waste, cooked-weight conversion, legacy batches, review-driven draft regeneration, receipt parsing, barcode validation and confirmed purchase imports. Checks cover cooking cadence, automatic portion regrouping, expiry-aware trips, parallel grain/sauce tasks, attended-work blocking, oven reservations and deadlock-free walkthroughs for every recipe. Macro regressions include a feasible £40 week with seven target-matching days, impossible budgets, external meals, hard dislikes, optional/daily shakes, label overrides and immutable cooked nutrition. Authenticated API journeys verify preview non-mutation, stale revisions, invalid targets, stock transactions and persistence across a server restart. Tests use isolated temporary account stores, not the user's live data.

Browser checks verified batch-yield screens, the live grams-per-serving calculation, weekly review controls, receipt-text review, and on-device OCR of a fictional receipt image. A live Open Food Facts lookup succeeded for a public example barcode. Barcode-photo decoding, real supermarket receipts and iPhone camera formats still need broader device testing. The user's saved stock and health records were not modified by the browser checks.

The owner has deployed the private beta to Vercel/Neon and reported completing the initial hosted account checks. Full hosted mutation, database backup/restore and device coverage remain separate acceptance work. Local browser checks of this upgrade verified the target live preview, expanded appliance list, current-week rebalance preview/cancellation and scheduled shopping links without adding food/health records or applying a replacement week.

## Completed follow-up features

- Batch-first planning defaults to three-day cooking blocks and weekly shopping, with editable two-day/daily alternatives and a hob-ring count. Existing weeks can be regrouped without replacing their recipes or completed food. New plans repeat both main meals and breakfast/snack options within a block to reduce preparation work.
- Servings are counted from the unprepared meal occurrences, not an arbitrary fixed batch of four. Swapping, restoring or skipping meals regroups the remaining batch. Preparing food is still a separate confirmation, including a fridge/freezer split calculated for the actual cooking date.
- Cooking stages are broken into single-action cards. A dependency graph joins rice/pasta back to the finished dish, holds hob/oven resources throughout cooking and permits parallel work only during suitable waiting stages. The next task is recommended, with alternatives tucked away. Timers keep their own deadlines and require food checks; no timer marks food cooked automatically.
- A browser check verified the focused recipe actions and full-batch ingredient quantities. The user's requested three-day cooking / weekly shopping rhythm and two hob rings were saved. No fictional food, purchases or health readings were added.
- Walkthrough progress is intentionally tab-local; reliable locked-screen alarms and server-synced walkthrough recovery are not implemented. No Tasty videos or photos were copied. This is an original interface using the existing recipe library and technique illustrations.

- One batch explicitly yields N servings. Yield changes scale the recipe and shopping list. Extra servings become unallocated cooked stock. Net cooked batch weight gives grams per serving; it is optional and can be recorded later.
- A meal can be eaten in portions or grams. Nutrition is scaled from the saved cooking-time nutrition snapshot. Unconsumed fractions are released for reuse. Fridge/freezer lots retain their origin, serving weight and use-by metadata, including across fractional splits.
- Weekly reviews are editable and keep explicit recipe ratings. Effort and hunger influence recipe ranking, with optional budget or discovery priorities. Enjoyment and free text are stored for reflection, not presented as AI interpretation. Regeneration only replaces a draft with no purchases, cooked or eaten meals, and requires an explicit checkbox.
- Receipt photos are processed locally; users can also paste receipt text. Rows are never selected by default. Every included row needs an ingredient match, edible pack quantity and actual line price. Validation precedes all stock/spending writes, and import IDs prevent repeat submission.
- Barcode photos are decoded locally; external lookup requires barcode-only consent. Returned nutrition is nullable and is applied only after explicit label verification. No receipt photo or text is sent to the server. The free Open Food Facts lookup is not a retailer price feed.

## Candidate next features

Prioritise these after real kitchen testing, not all at once:

1. A beginner techniques collection: verified short videos for chopping, pan heat, doneness, cooling and reheating. Label illustrative images; never use a photo as proof food is safely cooked.
2. Meal-linked glucose context: connect before/after readings with the actual meal and timing, without claiming that a single meal caused a change.
3. A clinician-friendly progress export with units, timing and missing-data warnings.

Photos of the actual tested recipes would be more useful than decorative stock imagery. This build has simple diagrams, linked technique help and three labelled original AI illustrations, not a complete tested photo/video recipe library.

## Mise-inspired experience update — 26 September 2026

- Today leads with a next action and breakfast/lunch/snack/dinner; actual diary totals are explicitly separate. The weekly plan uses seven day buttons and compact budget/target warnings. Detailed nutrition, sessions and review forms remain available on demand. A missing current week offers an explicit draft-from-today action, leaving saved weeks intact.
- Recipe detail has ingredient/instruction tabs, exact full-batch quantities, per-serving estimated nutrition, active preparation time, and state-aware preparation or serving guidance. Cooked nutrition uses stored snapshots; expired/missing lots cannot offer an eat action. Cold assembly no longer gives reheating instructions. Three exact-match labelled AI illustrations are original project assets (RECIPE_ASSETS.md); no Mise or Tasty media was copied.
- Swap previews compare measured servings, daily target gaps, full-pack grocery cost, changed batches, cooking dates and released leftovers. Previewing never commits the swap; confirmation still uses the normal optimistic-revision mutation. Purchases already made remain counted.
- Buy and My kitchen are separate tabs. The multi-item purchase review starts with nothing selected and actual prices blank. Confirming validated quantities and paid totals atomically records purchases and increases inventory. Planned future-trip coverage is distinguished from actual stock. Receipt/barcode entry and individual price/stock controls remain available.
- Browser checks covered desktop/390px mobile layouts, day selection, measured recipe steps, recipe tabs, labelled-image loading, swap preview/cancellation, purchase review/cancellation and inventory navigation. No fictional health/food/purchase entries or replacement week were saved into the user's browser account. Expired, frozen, historical and missing-lot states are covered by automated tests with synthetic data.
- Existing target settings and plans remain as saved. To adopt different macro preferences, edit nutrition targets in Settings and review the plan's balance preview; saving settings alone does not replace an existing week.
- Final verification for this update: 101 automated tests passed, production asset build passed, and local desktop/phone browser checks reported no console errors. Hosted write journeys were not performed against the owner's real account; API mutation journeys used isolated temporary accounts.
