# CookWell

A private, full-stack cooking and food-tracking test app. The current app lives at the **repository root**. The original static prototype is preserved in `cookwell-uk/`; do not select that folder when deploying the new app.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Create your own account and save the recovery code in a password manager. Account recovery uses this code; no email service is connected.

Local account data is saved in `.data/accounts.json` and survives restarting the server. It is excluded from Git. Protect this directory: health records are not application-encrypted at rest. Local disk mode is for a single development server, not shared hosting.

```sh
npm test
```

Tests cover onboarding, constraints, swaps, pack costs, stock transactions, leftovers, food diary calculations, BMI calculations, authentication, recovery, isolation, stale writes, rollback, and persistence after a server restart. Tests use fictional accounts, not your real health information.

## Working in this build

- Five-step onboarding: routine, budget, equipment, food exclusions, discovery, energy estimate, optional clinician-set glucose targets, and an editable weight milestone.
- A seven-day plan with breakfast, lunch, snack and dinner; individual swaps, eating-out and skipped slots.
- Editable daily calorie, protein, carbohydrate, fat, fibre and salt targets. Onboarding asks about protein restrictions, a balanced/moderate-carbohydrate/custom approach, and optional protein shakes. Settings shows the calculations, sources and practical planning ranges.
- Macro-aware weekly planning evaluates full daily menus and cooking blocks against ingredient-derived nutrition, available stock and full-pack checkout cost. The Plan screen checks each day, displays unmet targets and budget gaps, and offers a non-destructive rebalance preview before applying changes to unprepared meals. Prepared food and historical nutrition snapshots are preserved.
- The actual food diary compares recorded nutrients with daily targets. Empty or incomplete entries remain visibly unknown; the planned menu is never counted as food eaten.
- Direct Like / Dislike / Clear preference controls on recipes. The latest dislike excludes a recipe from future generation and recommendations; likes influence ranking without becoming hard cuisine rules. Existing meals remain until explicitly changed or rebalanced.
- Cooking cadence: batch every 2 or 3 days, or daily. New three-day plans use cooking days 1/4/7 and repeat meals within each block; same-recipe occurrences are combined automatically. One session can prepare breakfast, snacks and multiple main dishes. Existing weeks can be regrouped with **Set my rhythm**, preserving their recipes and completed food.
- Focused cooking walkthroughs: one action at a time, exact batch quantities, recommended next tasks, independent timers and explicit food checks. Rice/pasta can cook while another task is prepared; attended pan work does not suggest multitasking. Hob counts and the single oven are reserved so they cannot be overbooked.
- Weekly shopping or 2/3-day trips, with full-pack carryover and raw-stock expiry checked against the cooking date. Later-trip figures are forecasts until purchases are confirmed; verify pack use-by dates and freeze suitable ingredients when needed.
- A structured 33-recipe library, quantity-derived nutrition, exact metric ingredients, short guided steps, timers, simple technique diagrams and a relevant external onion-chopping tutorial link. Includes more protein/fibre-rich meals and a measured whey-and-water option, mixed fresh rather than stored as a multi-day batch.
- Grocery quantities net of stock, full-pack costs, editable pack prices and nutrition. Three Tesco products have dated snapshots; other prices are explicitly estimates.
- Purchase confirmation adds raw stock. Preparing a meal deducts raw stock once and creates measured portions. Eating records nutrition and consumes a portion.
- Swapping a cooked meal leaves its food in the kitchen. Unallocated portions can be assigned to another meal; eligible unallocated frozen portions can carry into a future draft.
- Adjustable batch yield: one cooking session makes an explicit number of servings. Record the net finished weight to see grams per serving; ingredients and shopping requirements scale with the yield.
- Partial portions or grams eaten, fractional waste, and split fridge/freezer lots. Nutrition uses the amount actually eaten; uneaten fractions stay available for later meals.
- A weekly review covering enjoyment, hunger, effort, spending, waste and recipe ratings. Ratings and structured preferences influence later plans; optionally rebuild an unused next-week draft. Calorie targets are not changed automatically.
- Receipt photo/text parsing and barcode photo/number lookup, followed by editable, opt-in purchase rows. Confirmed imports add stock and spending and update pack prices. Receipt photos/text stay in the browser; barcode lookup sends only the code to Open Food Facts.
- Weekly draft generation on return to the app near the end of a week. Shopping estimates account for outstanding earlier plans; stock is checked before confirmation.
- Food diary by day: actual eaten recipe portions plus extra food, drinks and restaurant entries. Supports pack nutrition per 100 g or per portion; missing macros remain unknown.
- Manual weight, glucose, steps, workout calories, waist, sleep, energy, HbA1c and blood-pressure logs. Weight/glucose charts, BMI reference range and an editable first milestone.
- Separate accounts, password hashing, HttpOnly sessions, invitation-only hosted registration, export and password-confirmed account deletion.
- Responsive interface, home-screen manifest and an offline notice. Private records are not stored in a service-worker cache.
- A prioritised in-app action centre for due cooking and shopping sessions, expiring raw or cooked food, weekly reviews and optional daily health check-ins. It does not require notification permission and does not send background alerts.

Dates for meals and the diary use Europe/London, including daylight saving. Calorie intake does not automatically increase when workout calories are logged.

## Vercel deployment setup

The private beta is deployed at [CookWell](https://cook-well.vercel.app/) with Neon PostgreSQL. The owner reported completing the initial hosted account checks and deleting the disposable account. Automated mutation tests run against isolated local stores; that is not a substitute for PostgreSQL backup/restore or hosted end-to-end testing. The following checklist also applies when setting up a new deployment.

1. Import this GitHub repository into Vercel with the repository root selected.
2. Select **Other** as the framework. Install dependencies with `npm ci`, use `npm run build` as the build command, and `public` as the output directory. The build bundles the on-device OCR/barcode reader and copies its worker/language files. Generated `public/vendor/` files are intentionally not committed. `npm run dev` builds them automatically; run the build first if using `npm start`.
3. Connect a PostgreSQL database. Put its connection string in the server-only `DATABASE_URL` environment variable. Follow the provider's TLS settings; do not disable certificate verification.
4. Set a strong private `INVITE_CODE`. Hosted registration refuses to operate without it. Do not put credentials in source control or in browser-facing variables.
5. Deploy, then test registration, onboarding, purchase/cook/eat, refresh, sign-out/sign-in, account separation, export, recovery and deletion using a disposable test account.
6. Only after those checks, create your personal account. Open the HTTPS URL in Safari and use Share → Add to Home Screen.

The server creates a `cookwell_accounts` table on first connection. The database role needs permission to create it, or the table should be provisioned before deployment. Each account's state is a JSONB record; PostgreSQL transactions and per-account locks protect changes. No production data migration from the old browser-only prototype is included.

See [Vercel's Node.js runtime documentation](https://vercel.com/docs/functions/runtimes/node-js). Hosting/database plan availability and pricing must be checked before choosing a service; no paid service has been purchased or enabled.

## Honest boundaries and next work

- **AI recipe generation is not implemented or connected.** Recipe requests currently search the structured library without API cost. Before enabling AI, agree the provider/model and spend limit, add consent and structured-output validation, and test food-safety constraints.
- **No live Tesco, Lidl or M&S feed.** Dated public snapshots and your purchase prices are not live stock, local availability or guaranteed checkout prices. Reliable retailer access and pack matching still need investigation.
- **No automatic Apple Health sync.** Steps are manual. Adding a website to the iPhone home screen does not provide HealthKit access.
- **No automatic medical diet adjustment from a glucose reading.** The app logs context and flags readings outside saved targets; it does not treat spikes, change medicines or promise remission.
- Generic nutrition values and cooking times require real-world recipe testing. Verify product labels, allergens, portions, food temperature and storage. The library is not clinically reviewed.
- The initial allergy model covers the allergens represented by this library, not every possible allergy or product cross-contamination warning.
- Split batches enforce hour-exact use-by limits. Defrosting requires explicit confirmation; already-thawed portions cannot be refrozen through the app. Follow the displayed cooling and reheating guidance.
- Receipt recognition is assisted entry, not an automatic checkout record. Review discounts, line totals, quantities and units. Product lookup is community data, may be unavailable or incomplete, and does not provide retailer prices. Imports currently match the existing ingredient library only. Verify the actual product's allergens and raw/dry/drained nutrition basis.
- Cooked grams are calculated from the weight of the original complete batch and its yield, not inferred from raw weight. Divide every component equally. Correcting cooked weight changes gram conversion, not the ingredient-derived calories or historical food logs.
- Cooking walkthrough progress and timers live in the current tab, not on the server. Closing the dialog keeps timers running; refreshing, signing out or closing the tab ends the walkthrough. Background alarms on a locked iPhone are not guaranteed. Keep an independent kitchen timer for safety; timers never prove doneness or automatically deduct ingredients.
- The action centre is shown when the app is opened. Push notifications and scheduled background reminders are not implemented.
- Three-day batches require freezing later portions. Date-only plans conservatively earmark rice for freezing after cooking day and other food from day three. Actual cooking confirmation recalculates this split for today's date. A fridge-only setup uses at most two-day batches; a rice swap without a freezer may add a same-day cooking task. No cold storage means daily preparation.
- Reheating/assembly still happens between batch sessions. Preparing several dishes can take substantially longer than 15–20 minutes; active-minute estimates are indicative sums, not a guaranteed schedule. A regrouped older week may contain more dishes than a newly generated batch-first plan.
- Nutrition and budget optimisation is a bounded heuristic, not a clinical prescription or a guarantee. Tight constraints can reduce variety or leave unmet targets / overspending, which are shown explicitly. A £40 synthetic 1,800-kcal moderate-carbohydrate test meets all seven daily planning ranges with three cooking sessions and one shopping trip; this does not establish that every profile or real checkout will do so. Finding a plan can take several seconds, especially for daily cooking or restrictive settings.
- Automatic protein uses a general 0.75 g/kg reference until relevant advice is supplied; reported no restriction plus a weight-loss goal enables an editable 1.2 g/kg planning suggestion. Moderate carbohydrate uses 40% of energy as an opt-in planning choice, not a diabetes-specific prescription. Fat uses the remaining energy; fibre defaults to 30 g and salt to a maximum of 6 g. Restricted protein requires clinician-entered custom targets. No meal is labelled as guaranteed not to spike glucose.
- Shakes are optional and cost the full powder pack when buying it, not just one scoop. The generic whey label and price are estimates. Milk allergens and shaker equipment are enforced. Air fryer, rice cooker and slow cooker choices are saved, but the current library does not yet offer their methods as substitutes for required hob/oven equipment.
- Weekly drafts are created when the app is opened, not by a scheduled background job.
- Before public launch: clinical/food-safety review, privacy and consent review, verified database backups and restore tests, stronger abuse protection, observability, accessible-device testing, broader recipe coverage and hosted end-to-end testing.

## Project map

The current interface includes a compact Today view, a selectable seven-day plan, preview-before-confirm meal changes, measured batch recipes, and separate Buy / My kitchen tabs. Detailed health and nutrition data remains available without dominating the meal screens. Three original AI recipe illustrations are labelled; see `RECIPE_ASSETS.md` for the assets and prompts. No runtime image-generation or other paid AI service is enabled.

- `public/`: responsive UI, shared calculations and offline shell
- `public/*-experience.js`: focused meal, recipe, shopping and swap presentation
- `lib/swap-preview.mjs`: read-only cost, nutrient and batch impact previews using the actual swap rules on a clone
- `client/capture.js`, `scripts/build.mjs`: locally bundled photo readers; no receipt-photo upload or paid OCR service
- `api/index.js`: authenticated HTTP endpoints
- `lib/catalog.mjs`: structured recipes, ingredients and cooking instructions
- `lib/domain.mjs`: planning, shopping, inventory and logging rules
- `lib/batch-actions.mjs`, `lib/reviews.mjs`, `lib/purchase-import.mjs`: partial servings, learning feedback and confirmed purchase transactions
- `lib/rhythm.mjs`: automatic batch grouping, storage allocation and scheduled shopping
- `lib/nutrition-planner.mjs`, `lib/nutrition-seeds.mjs`: bounded macro/pack-cost search and seven-day reporting
- `public/nutrition-targets.js`, `public/nutrition-ui.js`, `public/preferences.js`: shared target calculations, target/diary UI and reversible recipe preferences
- `public/cook-flow.js`, `public/session-cooking.js`: dependency/equipment-aware guided cooking and concurrent timers
- `lib/store.mjs`: PostgreSQL transactions and local development persistence
- `tests/`: automated regression tests
- `PRODUCT_MVP.md`: original product specification
- `IMPLEMENTATION_NOTES.md`: decisions, changes and acceptance notes for this build

## Product data and photo readers

Barcode lookups use [Open Food Facts](https://world.openfoodfacts.org), whose community database is available under the [Open Database License](https://world.openfoodfacts.org/data). The app shows attribution when reviewing returned product data. It does not retrieve product images. Receipt recognition uses [Tesseract.js](https://github.com/naptha/tesseract.js), and barcode photos use [ZXing Browser](https://github.com/zxing-js/browser). These libraries are bundled at build time; images are processed in the browser. The first receipt scan downloads the reader and English language model from your app host.
