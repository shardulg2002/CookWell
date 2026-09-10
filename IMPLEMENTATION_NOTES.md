# Implementation notes — 10 September 2026

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

The automated suite currently contains 23 passing tests. Browser verification has covered fresh onboarding, empty equipment selection, generated meals, budget details and guided recipe screens. A fictitious local browser-testing account was used; it is not a user profile template.

The PostgreSQL implementation and Vercel configuration exist, but no hosted database or deployment was available for verification. Use the deployment checklist in README before entering personal health data online.

## Candidate next features

Prioritise these after real kitchen testing, not all at once:

1. Partial servings and batch splitting: accurately record eating half a portion and freeze only the later portions.
2. A short weekly review: meals enjoyed, cooking effort, hunger/fullness, waste and grocery spend. Use explicit feedback to improve the next draft.
3. Receipt/barcode-assisted entry: reduce stock and price bookkeeping, with a confirmation screen before saving.
4. A beginner techniques collection: verified short videos for chopping, pan heat, doneness, cooling and reheating. Label illustrative images; never use a photo as proof food is safely cooked.
5. Meal-linked glucose context: connect before/after readings with the actual meal and timing, without claiming that a single meal caused a change.
6. A clinician-friendly progress export with units, timing and missing-data warnings.

Photos of the actual tested recipes would be more useful than decorative stock imagery. This build has simple diagrams and linked technique help, not a complete photo/video recipe library.
