# Implementation notes — 11 September 2026

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

All 43 automated tests pass. They cover the original workflows plus custom batch yields, split-lot reservations, fractional eating/waste, cooked-weight conversion, legacy batches, review-driven draft regeneration, receipt parsing, barcode validation and confirmed purchase imports. New checks cover cooking cadence, automatic portion regrouping, expiry-aware trips, parallel grain/sauce tasks, attended-work blocking, oven reservations and deadlock-free walkthroughs for every recipe. Authenticated API journeys verify rhythm preferences, stock transactions and persistence across a server restart. Tests use isolated temporary account stores, not the user's live data.

Browser checks verified batch-yield screens, the live grams-per-serving calculation, weekly review controls, receipt-text review, and on-device OCR of a fictional receipt image. A live Open Food Facts lookup succeeded for a public example barcode. Barcode-photo decoding, real supermarket receipts and iPhone camera formats still need broader device testing. The user's saved stock and health records were not modified by the browser checks.

The PostgreSQL implementation and Vercel configuration exist, but no hosted database or deployment was available for verification. Use the deployment checklist in README before entering personal health data online.

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

Photos of the actual tested recipes would be more useful than decorative stock imagery. This build has simple diagrams and linked technique help, not a complete photo/video recipe library.
