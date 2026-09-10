import { randomUUID } from "node:crypto";
import { recipeMap, recipeNutrition } from "./catalog.mjs";
const fail = (m) => {
  throw Object.assign(new Error(m), { status: 400 });
};
export function learningBias(state, recipe, cost = 0) {
  const review = (state.reviews || [])
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .at(-1);
  if (!review) return 0;
  let score = 0;
  if (review.priority === "budget") score -= cost / 80;
  if (review.effort >= 4 || review.priority === "easier")
    score -= recipe.active * 0.16;
  if (review.hunger >= 4) {
    const n = recipeNutrition(recipe);
    score += Math.min(3, ((n.protein + n.fibre * 2) / n.kcal) * 20);
  }
  if (
    review.priority === "variety" &&
    !state.feedback.some((f) => f.recipeId === recipe.id)
  )
    score += 2;
  return score;
}
export function saveReview(state, plan, data) {
  const check = (v, label) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) fail(label + " must be 1–5.");
    return n;
  };
  const priority = String(data.priority || "same");
  if (!["same", "easier", "variety", "budget"].includes(priority))
    fail("Choose a next-week priority.");
  const ratings = (data.ratings || []).map((f) => {
    if (
      !recipeMap[f.recipeId] ||
      !plan.meals.some((m) => m.recipeId === f.recipeId) ||
      !["love", "okay", "dislike"].includes(f.rating)
    )
      fail("Choose a valid recipe rating.");
    return { recipeId: f.recipeId, rating: f.rating };
  });
  const old = (state.reviews || []).find((r) => r.planId === plan.id);
  const review = {
    id: old?.id || randomUUID(),
    planId: plan.id,
    start: plan.start,
    hunger: check(data.hunger, "Hunger"),
    enjoyment: check(data.enjoyment, "Enjoyment"),
    effort: check(data.effort, "Effort"),
    priority,
    note: String(data.note || "").slice(0, 1000),
    ratings,
    updatedAt: new Date().toISOString(),
  };
  state.reviews = (state.reviews || []).filter((r) => r.planId !== plan.id);
  state.reviews.push(review);
  state.feedback = state.feedback.filter((f) => f.reviewId !== review.id);
  for (const f of ratings)
    state.feedback.push({
      ...f,
      id: randomUUID(),
      reviewId: review.id,
      effort: review.effort >= 4 ? "hard" : "right",
      date: plan.start,
      note: "",
    });
  return review;
}
