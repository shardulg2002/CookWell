# CookWell UK — Build-Ready MVP Specification

## 1. Product definition

**CookWell UK** is a responsive, single-user web app for a student living alone in Coventry who is learning to cook, wants to spend up to £40 per week on groceries, batch-cooks every 3–4 days, and wants to improve weight, activity and type 2 diabetes self-management.

It answers four daily questions:

1. What should I eat and cook today?
2. What do I need to buy, and can I afford it?
3. What food do I have and need to use first?
4. Are my habits, weight and glucose trends moving in the right direction?

The product is a cooking and self-management aid, not a medical device, dietitian, or medication adviser.

## 2. MVP goal and non-goals

### Goal

Take a user from an empty kitchen to a practical first 7-day plan containing beginner-friendly recipes, a £40-aware shopping list, simple inventory, and optional manual health tracking.

### Success moment

Within 10 minutes of first opening the app, the user has:

- completed onboarding;
- reviewed a 7-day meal plan designed around 3–4 portion batch cooking;
- seen its estimated cost and grocery list;
- marked their first cooking session complete.

### Explicitly out of scope for the MVP

- Live retailer price scraping, retailer checkout or automatic basket creation.
- Apple Health / HealthKit, wearable, CGM, or Bluetooth meter integration.
- Medication recommendations, insulin calculations, diagnosis, clinical escalation, or emergency instructions.
- Barcode scanning, receipt OCR, multi-user households and social features.
- Fully generative recipes or meal plans. Use a curated recipe catalogue plus transparent rules first.
- Native mobile apps. Build a responsive web app / PWA-ready interface first.

## 3. Target user defaults

Pre-fill these only in local development/demo mode; real users answer onboarding questions.

| Field | Default profile |
|---|---|
| Household | 1 person |
| Weekly grocery budget | £40, excluding eating out |
| Location | Coventry, UK |
| Cooking rhythm | 2 batch cooks/week; 3–4 portions each |
| Active cook-time limit | 20 minutes |
| Equipment | Induction hob, oven, microwave, fridge/freezer |
| Initial signals, not rules | Enjoys spicy food; has mentioned Thai and Italian; eats chicken often; no plain milk |
| Diet | Omnivore |
| Goals | Weight loss, energy, steadier glucose |
| Glucose input | Manual finger-prick readings |

## 4. Product principles

- **Beginner-safe:** never assume cooking knowledge. Each step names heat, timing and visual cues.
- **Practical over perfect:** a repeatable plan beats a nutritionally ideal plan the user will not make.
- **Budget is visible:** cost appears on the plan, recipe and shopping list.
- **No shame:** missed meals, takeaways and weight changes are treated as data, not failures.
- **Learn, then personalise:** a favourite cuisine is a starting signal, not a permanent constraint. The app earns personalisation from cooking feedback.
- **Health-conscious, not prescriptive:** show nutrition and trends; never tell users how to change medicines or promise a food will correct a glucose reading.
- **Progressive disclosure:** show the next useful action first; detailed macros and charts are one tap away.

## 5. Core user journeys

### A. First-run onboarding (5–8 minutes)

1. Welcome: “Build your first week of food.”
2. Household and budget: people served, weekly grocery limit, eating-out spending excluded/included.
3. Routine: days available for batch cooking, active time limit, expected eating-out nights.
4. Food: diet, allergies, foods to avoid, spice preference, and optional cuisines/proteins the user already knows they enjoy. Explain that these are starting hints and the plan will include variety.
5. Equipment: selectable checklist.
6. Goals: weight, energy, glucose-awareness; optional starting weight.
7. Glucose set-up (optional): unit (`mg/dL` or `mmol/L`), user-entered pre-meal and post-meal targets, and a clear statement that these should match their care-team plan.
8. Generate plan.

**Validation:** budget must be greater than zero; allergies/dislikes must exclude incompatible recipes; glucose targets must be unit-labelled and may be skipped.

### B. Generate and edit a weekly plan

1. User selects **Plan**.
2. The app creates seven daily cards with breakfast, lunch, a snack and dinner. An eating-out choice can replace any planned meal.
3. Two dinner recipes are batch recipes, each assigned to 3–4 meals on selected days.
4. The user can choose **Swap meal**. Swaps only show recipes compatible with their diet, disliked foods, equipment, active-time limit and remaining weekly budget.
5. The user can set a meal to **Eating out**. The recipe is removed from the plan and any ingredients used nowhere else are removed from the list.
6. When the next week is generated, the planner treats available inventory and items nearing expiry as its first ingredients to use; it then fills the remaining grocery list and budget gap.
6. Header updates: estimated grocery cost / £40, batch-cook sessions, remaining unplanned meals.

### C. Shop and stock the kitchen

1. User opens **Shop & Kitchen**.
2. Grocery list groups items by aisle: fruit & veg, protein, dairy/chilled, cupboard, frozen, other.
3. Each item shows required quantity, estimated price, recipe usage and a checkbox.
4. Unknown price has an editable price field labelled “What did you pay?”; its saved price becomes the user’s current estimate for the item.
5. Checked purchases can be added to inventory in one action.
6. Inventory displays quantity, unit, optional expiry date and status: use soon / available / frozen.

### D. Cook a recipe

1. User opens a meal from **Today** or **Plan**.
2. Recipe header shows total time, active time, portions, equipment, estimated cost per portion, calories, protein, carbs, fibre and a simple nutrition summary.
3. **Cook mode** presents one large numbered step at a time with back/next and a timer when relevant.
4. User marks it cooked, rates it with four short prompts, and chooses whether leftovers went into fridge/freezer. Treat this feedback as stronger evidence than initial cuisine preferences.
5. Ingredient quantities decrement from inventory where available.

### E. Log health and review trends

1. User opens **Progress** and can log weight, steps, workout calories and a glucose reading.
2. A glucose entry requires reading + unit + timing (`before meal`, `after meal`, `other`); meal/context are optional.
3. Dashboard shows neutral summaries: e.g., “3 post-meal readings logged this week” and “Weight trend is down 0.3 kg over 14 days.”
4. If a reading is outside the user’s saved target range, show: “This is outside the target range you entered. Follow the plan agreed with your healthcare team if you feel unwell or are concerned.” No food, medication, or dosage instruction.

## 6. Information architecture and screens

Use a persistent mobile bottom navigation and desktop left navigation.

### Today

- Date, daily plan and next action.
- “Cook tonight” primary card.
- Compact weekly budget bar.
- Optional one-tap health logging buttons: glucose, weight, steps.
- “Use soon” inventory card only when items expire in 3 days or less.

### Plan

- Week picker and 7-day horizontal/vertical calendar.
- Meal cards for breakfast, lunch, snack and dinner, each with recipe title, leftover badge, cook-time and cost/portion.
- Plan summary: estimated grocery cost, meals cooked at home, eating-out slots, batch-cook sessions.
- Actions: swap, mark eating out, regenerate week (confirmation required), add a meal.

### Recipe detail / cook mode

- Hero-free layout; prioritise practical content over food photography.
- Ingredient list scaled by servings.
- Equipment checklist.
- Detailed beginner steps, timers, storage/reheating notes and substitutions. Every ingredient is listed with an exact metric quantity for the selected number of servings (g, ml, or a count where weighing is not practical).
- Nutrition panel with calories, protein, carbohydrates, fibre, fat, salt, estimated price/portion.
- “Made it” feedback sheet: make again / effort / spice / fullness.

### Shop & Kitchen

- Tab 1: grocery list with budget total, editable price and buy checkbox.
- Tab 2: inventory with quantity, expiry, frozen state and “use in a meal” suggestion.
- Pantry staples are optional and visually separate from required items.

### Progress

- Top summary: current weight, 14-day change, weekly average steps, glucose logs this week.
- Log buttons.
- Charts: weight trend, steps by day, glucose readings by time/timing.
- Nutrition averages: calories, protein, fibre, carbs, using cooked/planned meals only and labelled accordingly.
- User-set targets are displayed beside relevant charts.

### Settings

- Profile, food preferences, allergies/dislikes, equipment, budget, plan rhythm, health targets/units.
- Export/delete data placeholder.
- Health disclaimer and link to user’s care plan.

## 7. Meal-planning rules (deterministic MVP)

The planner chooses recipes from the seed catalogue using these hard filters:

1. Matches diet and excludes allergens/dislikes.
2. Requires only owned equipment.
3. Active cooking time is at or below user limit, unless user explicitly accepts a longer prep meal.
4. Batch recipes yield 3–4 portions; single meals yield 1–2 portions.
5. Fill selected eating-out slots with no recipe.

Then score remaining candidates:

- +1 matches an initial cuisine/protein signal. Never make cuisine matching a hard requirement.
- +3 matches a recipe the user has made and marked “make again.”
- +2 is from a cuisine the user has not tried recently (the weekly plan includes one intentional discovery meal by default, unless the user turns exploration off).
- +2 batch recipe when a batch session is due.
- +2 reuses an ingredient already selected that week.
- +1 high protein and fibre according to the recipe data.
- -3 if it introduces an expensive, single-use ingredient.
- -2 if the plan repeats the same dinner twice in one week unless it is a planned leftover.
- -2 if more than two non-leftover dinners share the same cuisine in one week.

Choose the lowest-cost valid combination under the budget while meeting the variety rules. If no combination fits, show the cheapest valid draft plus: “This plan is £X above budget—swap these items,” and offer concrete lower-cost swaps.

The initial plan should use two batch dinners, five breakfast options and two quick lunch/leftover options. It should normally include several cuisines (for example Thai-style, Italian-style, South Asian, Mediterranean, East Asian, Mexican-inspired, British-style) without assuming any particular cuisine is wanted every week. Do not calculate a personalised calorie deficit in the MVP.

## 8. Seed recipe catalogue (minimum 12 recipes)

Each recipe needs structured data, not just prose. Include:

- spicy chicken & vegetable coconut curry (batch; hob)
- chicken, pepper & tomato pasta bake (batch; oven)
- turkey or chicken chilli with beans (batch; hob)
- chicken and broccoli stir-fry with rice (batch; hob)
- lentil and vegetable dhal (batch; hob)
- spicy tuna tomato pasta (quick; hob)
- tray-baked chicken, peppers & potatoes (batch; oven)
- egg fried rice with vegetables (quick; hob)
- overnight oats with Greek yoghurt and berries (breakfast; no-cook)
- eggs on wholegrain toast with spinach (breakfast; hob)
- Greek yoghurt, fruit and nuts (breakfast; no-cook)
- microwave jacket potato with tuna/bean filling (quick; microwave)

Every recipe must include an ingredient-price estimate, substitutions, allergen tags, equipment, storage time, freezer suitability, active and total time, all nutrition fields, and explicit step-by-step cooking instructions. Seed recipes must span several cuisines rather than being concentrated in Thai and Italian food.

## 9. Data model

Use a relational database or equivalent typed storage. Suggested entities:

```text
UserProfile
  id, householdSize, postcodeArea, weeklyBudgetPence, eatingOutIncluded,
  preferredCuisines[], proteinPreferences[], dislikes[], allergens[], diet,
  equipment[], activeCookLimitMinutes, batchCookDays[], goalFlags[],
  glucoseEnabled, glucoseUnit, preMealMin, preMealMax, postMealMin, postMealMax

Recipe
  id, title, mealTypes[], cuisines[], servings, activeMinutes, totalMinutes,
  equipment[], ingredients[], steps[], nutritionPerServing, costEstimatePence,
  storageNotes, freezerSuitable, allergens[], dietTags[], spiceLevel

Ingredient
  id, canonicalName, aisle, defaultUnit, pantryStaple, allergens[]

RecipeIngredient
  recipeId, ingredientId, quantity, unit, optional, substituteIngredientIds[]

PriceEstimate
  id, userId, ingredientId, retailer, packSize, pricePence, source,
  observedAt, isUserEntered

MealPlan
  id, userId, weekStart, estimatedCostPence, budgetPence, generatedAt

PlannedMeal
  id, mealPlanId, date, mealType, recipeId|null, servings, status,
  isEatingOut, leftoverOfPlannedMealId|null

InventoryItem
  id, userId, ingredientId, quantity, unit, boughtAt, expiresAt|null,
  storageLocation, status

HealthLog
  id, userId, recordedAt, type, value, unit, timing|null,
  linkedPlannedMealId|null, note|null

RecipeFeedback
  id, userId, recipeId, cookedAt, makeAgain, effortRating,
  spiceRating, fullnessRating, note|null

CuisineAffinity
  id, userId, cuisine, triedCount, makeAgainCount, averageEffortRating,
  averageFullnessRating, lastTriedAt, explorationPreference
```

Store money as integer pence; never floating-point pounds. Store glucose values with their original unit and render unit beside every value.

## 10. Health and safety requirements

- Onboarding must ask for glucose unit before targets or readings.
- Persist target ranges exactly as user enters them; do not substitute generic medical thresholds.
- Label all nutrition values as estimates.
- Do not state that a food lowers blood glucose, cures diabetes, or replaces professional advice.
- Do not generate medication, insulin, fasting, or emergency-treatment instructions.
- Out-of-target reading UI must use calm, neutral language and direct the user to their clinician-agreed plan.
- Display a first-use disclaimer: “This app supports meal planning and self-tracking. It does not provide medical advice or replace your diabetes care team.”
- Keep health data private, exportable and deletable. No advertising use of health data.

## 11. Build approach

### Recommended first stack

- Front end: Next.js + TypeScript + Tailwind CSS (responsive web app).
- UI: accessible component library and chart library.
- Back end/database: Supabase/Postgres with Row Level Security, or a local-first mock repository for the prototype.
- Authentication: defer for a clickable prototype; add email/password before public deployment.
- Validation: Zod schemas shared by forms and API routes.
- Testing: Vitest for planning rules; Playwright for onboarding-to-plan and health-log flows.

### Build order

1. Static application shell and navigation using the four primary screens.
2. Seed recipe catalogue and typed recipe data.
3. Onboarding and editable profile/preferences.
4. Deterministic planner and editable plan screen.
5. Grocery-list costing and manual price editing.
6. Recipe detail/cook mode and feedback.
7. Inventory and leftover handling.
8. Manual health logging and charts.
9. Persistence/authentication and test coverage.

## 12. Definition of done / acceptance criteria

### Onboarding and plan

- A user can finish onboarding with the supplied default profile in under 10 minutes.
- The planner creates a seven-day plan with at least two batch recipes and user-selected eating-out slots.
- No planned recipe violates selected equipment, diet, allergies or dislikes.
- Plan cost is calculated from required grocery quantities after ingredient reuse and shown against the £40 budget.
- Replacing a meal updates plan, cost and grocery list immediately.
- A seven-day plan has no more than two non-leftover dinners from the same cuisine and includes one discovery meal by default.
- Initial preferences can influence the first plan but cannot exclude compatible cuisines; recipes marked disliked or too difficult by feedback are down-ranked in later plans.

### Grocery and inventory

- Grocery list merges duplicate ingredients and groups them by aisle.
- A user can edit an unknown price and see the total update.
- Marking an item bought can add it to inventory.
- A cooked meal reduces linked inventory quantities and offers to store leftovers.

### Recipes

- Every seed recipe has active/total time, portions, cost, nutrition, equipment, storage notes, substitutions and beginner steps.
- Recipe detail shows raw ingredient quantities in metric units for the chosen servings. Cook mode repeats the exact quantity required at every step so a user can weigh it accurately and nutrition estimates stay tied to the portion size.
- Cook mode supports step navigation and at least one embedded timer.

### Health

- A user can record weight, steps, workout calories and glucose manually.
- Every glucose reading includes unit and timing; invalid/blank readings cannot save.
- User-entered target ranges are displayed and an outside-range reading shows a neutral safety notice.
- No screen offers medical treatment or medication guidance.

### Quality

- Works cleanly at 375px mobile width and desktop width.
- Keyboard navigation, labels, colour contrast and screen-reader names are present for key flows.
- Unit tests cover recipe filtering, plan budget calculation, duplicate ingredient merging and glucose target comparison.

## 13. Post-MVP backlog

1. Apple Health steps/weight import via native iOS companion and HealthKit permission flow.
2. Receipt scanning and barcode-based inventory updates.
3. Retailer data integrations and user-confirmed location-aware prices; never rely on brittle scraping as the only price source.
4. Retailer basket handoff where supported.
5. Meal photo logging, voice-guided cooking, richer substitutions and AI-assisted recipe generation with guardrails.
6. Optional clinician-ready PDF/CSV summary of weight, glucose and adherence logs.

## 14. Open choices deliberately deferred

- Exact visual brand/name.
- Whether users create accounts before or after trying the first plan.
- Calorie target methodology (requires careful health/product review before personalisation).
- Which retailers have authorised price feeds or basket handoff.
- Native iOS versus Android timing.
