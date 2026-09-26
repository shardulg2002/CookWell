import { allocations, yieldInfo, tidy } from "./portions.js";
import { instructionList } from "./cooking.js";
import { ratingButtons } from "./preferences.js";
import { recipeMedia } from "./recipe-media.js";
import { dayKey } from "./metrics.js";
import { nutritionEvidence } from "./nutrition-evidence.js";

const keys = ["kcal", "protein", "carbs", "fat", "fibre", "salt"];
const round = (n) => Math.round(n * 10) / 10;
export function servingNutrition(state, meal, recipe, portions = 1) {
  if (meal?.status === "eaten") return meal.actualNutrition || null;
  if (meal && ["out", "skipped"].includes(meal.status)) return null;
  if (meal?.batchId) {
    const list = allocations(meal);
    if (!list.length) return null;
    const n = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const a of list) {
      const b = state.batches.find((b) => b.id === a.batchId);
      if (!b) return null;
      for (const k of keys) {
        // Historical snapshots can omit nutrients. Never turn unknown into zero.
        n[k] =
          n[k] !== null && Number.isFinite(b.nutrition?.[k])
            ? n[k] + b.nutrition[k] * a.portions
            : null;
      }
    }
    return n;
  }
  return Object.fromEntries(
    keys.map((k) => [
      k,
      Number.isFinite(recipe.nutrition?.[k]) && portions > 0
        ? recipe.nutrition[k] / portions
        : null,
    ]),
  );
}
export function recipeExperience(
  { state, recipe: r, meal: m, plan, batchSummary = "" },
  { esc, btn, dateLabel },
) {
  const prepared = !!m?.batchId,
    eaten = m?.status === "eaten";
  const planned = m?.status === "planned";
  const y = planned && !prepared ? yieldInfo(plan, m) : null;
  const portions = y?.portions || 1;
  const n = servingNutrition(state, m, r, portions);
  const allocated = m
    ? allocations(m).map((a) => ({
        ...a,
        batch: state.batches.find((b) => b.id === a.batchId),
      }))
    : [];
  const list = allocated.filter((a) => a.batch);
  const missing =
    prepared && (!allocated.length || allocated.some((a) => !a.batch));
  const frozen = list.filter((a) => a.batch.location === "freezer");
  // Match the server's use-by guard, including older date-only batches.
  const stale = list.some(
    (a) =>
      a.batch.expires < dayKey() ||
      (a.batch.safeUntil && Date.parse(a.batch.safeUntil) < Date.now()),
  );
  const cold = ["cold", "mash"].includes(r.method) || r.freshAssembly;
  const count = list.reduce((n, a) => n + a.portions, 0);
  const grams =
    list.length && list.every((a) => a.batch.gramsPerPortion)
      ? tidy(list.reduce((n, a) => n + a.portions * a.batch.gramsPerPortion, 0))
      : null;
  const title = eaten
    ? "RECORDED MEAL"
    : prepared
      ? r.freshAssembly
        ? "FRESHLY MIXED"
        : "FROM YOUR KITCHEN"
      : m && !planned
        ? "NOT COUNTED IN YOUR PLAN"
        : m
          ? `COOK ON ${dateLabel(y.root.cookDate || y.root.date)}`
          : "RECIPE LIBRARY";
  const summary = eaten
    ? "Nutrition below is the amount you recorded, not a new serving."
    : missing
      ? "A cooked portion linked to this meal is missing from Kitchen. Check your stored food before serving; the allocated amount cannot be verified."
      : prepared
        ? `${tidy(count)} allocated portion${count === 1 ? "" : "s"}${grams ? ` · ${grams} g finished food` : " · finished weight not recorded"}. No raw ingredients need to be used again.`
        : planned
          ? `1 cooking batch → ${portions} equal portion${portions === 1 ? "" : "s"}. Ingredients and steps below are scaled for the entire batch.`
          : "Base recipe quantities. Add this recipe to a meal slot to calculate your portions and shopping needs.";
  let primary = "";
  if (eaten) primary = '<p class="notice">✓ Saved in your food diary</p>';
  else if (prepared && planned)
    primary = stale
      ? '<p class="notice warn">This food is past its recorded safe-use time. Check Kitchen and record waste; do not eat it.</p>'
      : missing
        ? '<p class="notice warn">Stored portions are unavailable. Check Kitchen before continuing.</p>'
        : frozen.length
          ? `<div class="notice"><strong>Defrost before serving</strong><p>Defrost in the fridge. Only confirm when fully thawed.</p>${frozen.map((a) => btn("Confirm defrosted portions", "batch", `data-id="${esc(a.batch.id)}" data-op="thaw"`, "outline")).join("")}</div>`
          : btn("Log amount eaten", "eat", `data-id="${esc(m.id)}"`);
  else if (planned || !m)
    primary = `${btn(planned ? (r.freshAssembly ? "Mix 1 fresh serving →" : `Start cooking · ${portions} portion${portions === 1 ? "" : "s"} →`) : "Preview step-by-step →", "guided")}${planned ? btn(r.freshAssembly ? "Already mixed?" : "Already cooked?", "prepare", `data-id="${esc(m.id)}"`, "outline") : ""}`;
  const macros = n
    ? `<div class="recipe-macros">${keys.map((k) => `<div><strong>${Number.isFinite(n[k]) ? round(n[k]) : "—"}</strong><small>${k === "kcal" ? "kcal" : `${k} · g`}</small></div>`).join("")}</div>`
    : '<p class="notice">Nutrition is not available for this recorded meal.</p>';
  const ingredients =
    r.ingredients
      .map(
        (i) =>
          `<div class="ingredient"><strong>${esc(i.quantity)} ${esc(i.unit)}</strong><div>${esc(i.name)}<small class="source">${esc(i.nutritionSource)}</small></div></div>`,
      )
      .join("") + nutritionEvidence(r, prepared || eaten, esc);
  const steps = `${(r.cookingNotes || []).map((note) => `<p class="notice">${esc(note)}</p>`).join("")}<ol class="step-list">${r.steps.map((st) => `<li><h3>${esc(st.title)}</h3>${instructionList(st.text)}</li>`).join("")}</ol>`;
  const recipeDetails = `<div class="recipe-tabs" role="tablist" aria-label="Recipe details"><button id="ingredients-tab" role="tab" aria-controls="ingredients-panel" aria-selected="true" data-action="recipe-tab" data-id="ingredients">Ingredients</button><button id="instructions-tab" role="tab" aria-controls="instructions-panel" aria-selected="false" data-action="recipe-tab" data-id="instructions">Instructions</button></div><section id="ingredients-panel" role="tabpanel" aria-labelledby="ingredients-tab"><p class="hint section">${planned && !prepared ? `For the whole ${portions}-portion batch.` : "Reference recipe quantities."} Weigh ingredients raw, dry or drained as named; include oil and sauces. Nutrition remains an estimate and depends on the pack you use.</p>${ingredients}</section><section id="instructions-panel" role="tabpanel" aria-labelledby="instructions-tab" hidden>${steps}</section>`;
  const serving =
    prepared && planned && !stale && !missing
      ? `<section class="serving-guide"><h3>${cold ? "Serve your measured portion" : "Reheat your measured portion"}</h3><ol class="instruction-list"><li>Take only the ${tidy(count)} portion${count === 1 ? "" : "s"} allocated to this meal${grams ? ` (${grams} g)` : "; divide each component evenly"}. Leave the other portions stored.</li><li>${r.freshAssembly ? "Drink the freshly mixed shake now. Do not keep it as a multi-day batch." : cold ? "Keep chilled food refrigerated until serving and follow its recorded safe-use time." : "If frozen, defrost fully in the fridge first. Reheat only once until steaming hot throughout; stir so the centre heats evenly."}</li><li>After eating, log the actual amount. Any uneaten fraction stays in Kitchen; record waste there if it cannot be safely kept.</li></ol></section>`
      : "";
  const activeTime = Number.isFinite(r.active)
    ? `<p class="hint">${prepared || eaten ? "Original recipe · " : ""}${esc(r.active)} min active</p>`
    : "";
  return `<article class="recipe-detail">${recipeMedia(r, { hero: true })}<p class="eyebrow">${esc(title)} · ${esc(r.cuisine)}</p><h2>${esc(r.title)}</h2>${activeTime}<p class="intro">${esc(summary)}</p><p class="hint">${eaten ? "Recorded amount" : prepared ? "Allocated amount" : "Per equal serving"} · estimated nutrition</p>${macros}<div class="recipe-primary row">${primary}</div>${serving}${batchSummary ? `<details class="recipe-batch-details"><summary>${prepared ? "Portion weights & storage" : "Batch size, planned meals & portion weights"}</summary>${batchSummary}</details>` : ""}${prepared || eaten ? `<details class="section"><summary>Original recipe reference · not another cooking task</summary><p class="hint">Current ingredient labels may differ from the saved nutrition of this cooked food.</p>${recipeDetails}</details>` : recipeDetails}${ratingButtons(state, r.id, esc)}${planned ? `<details class="section"><summary>Change this meal</summary><div class="row section">${btn("Choose another recipe", "swap", `data-id="${esc(m.id)}"`, "outline")}${btn("Eating out instead", "meal-status", `data-id="${esc(m.id)}" data-status="out"`, "soft")}${btn("Skip this meal", "meal-status", `data-id="${esc(m.id)}" data-status="skipped"`, "soft")}</div></details>` : m && ["out", "skipped"].includes(m.status) ? btn("Restore meal", "meal-status", `data-id="${esc(m.id)}" data-status="planned"`, "outline") : ""}<p class="hint section">Images are illustrative, not portion measurements. Follow the weighed ingredients and cooking instructions.</p></article>`;
}
