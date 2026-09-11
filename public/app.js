import { dayKey, weightReference } from "./metrics.js";
import { createFeatures } from "./features.js";
import { createSessionCooking } from "./session-cooking.js";
import { createRhythmUI } from "./rhythm-ui.js";
import { yieldInfo, portionDescription } from "./portions.js";
import { reviewSummary } from "./review.js";
import { parseReceipt, suggestIngredient, validBarcode } from "./imports.js";
import { dailyCard, weightCard } from "./wellbeing.js";
import { instructionList } from "./cooking.js";
import { actionItems } from "./action-center.js";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cash = (p) => "£" + (p / 100).toFixed(2),
  round = (n) => Math.round(n * 10) / 10;
const localDay = () => dayKey();
let intakeDate = localDay();
let shoppingTripDate = "";
const addDays = (d, n) =>
  new Date(Date.parse(d + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const dateLabel = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
const slotNames = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};
let state,
  screen = "today",
  planId = null,
  authMode = "register",
  onboardStep = 0,
  activeRecipe = null,
  activeMeal = null,
  busy = false;
const catalog = () => Object.fromEntries(state.catalog.map((r) => [r.id, r]));
const chosenPlan = () =>
  state.plans.find((p) => p.id === planId) ||
  state.plans.find(
    (p) => p.start <= localDay() && addDays(p.start, 6) >= localDay(),
  ) ||
  state.plans[0];
const mealInfo = (id) => {
  for (const p of state.plans) {
    const m = p.meals.find((m) => m.id === id);
    if (m)
      return {
        p,
        m,
        r: catalog()[m.recipeId],
        batch: state.batches.find((b) => b.id === m.batchId),
      };
  }
  return {};
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
async function api(action, data, method) {
  const response = await fetch("/api/index?action=" + action, {
    method: method || (data ? "POST" : "GET"),
    credentials: "same-origin",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state) {
      sessionCooking.reset();
      state = null;
      renderAuth();
    }
    throw new Error(result.error || "Something went wrong.");
  }
  return result;
}
async function mutate(action, data, close = true) {
  if (busy) return false;
  busy = true;
  try {
    const result = await api("mutate", {
      action,
      data,
      revision: state.revision,
    });
    state = result.state;
    if (close) closeDialog();
    render();
    return true;
  } catch (e) {
    showError(e);
    return false;
  } finally {
    busy = false;
  }
}
function showError(e) {
  const node = $("#dialog[open] .error") || $("#app .error");
  if (node) node.textContent = e.message;
  toast(e.message);
}
function modal(html) {
  const d = $("#dialog");
  d.innerHTML = `<button class="close" data-action="close" aria-label="Close dialog">×</button>${html}<p class="error" role="alert"></p>`;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
function closeDialog() {
  $("#dialog").close();
}
const btn = (label, action, data = "", style = "") =>
  `<button class="btn ${style}" data-action="${action}" ${data}>${label}</button>`;
const empty = (title, body) =>
  `<div class="empty"><h3>${title}</h3><p>${body}</p></div>`;
const nutrition = (n) =>
  `<div class="nutrition">${Object.entries({
    kcal: "kcal",
    protein: "protein · g",
    carbs: "carbs · g",
    fat: "fat · g",
    fibre: "fibre · g",
    salt: "salt · g",
  })
    .map(
      ([k, label]) =>
        `<div><strong>${round(n[k] || 0)}</strong><small>${label}</small></div>`,
    )
    .join("")}</div>`;
function renderAuth() {
  closeDialog();
  $("#app").innerHTML =
    `<div class="auth-page"><section class="auth-story"><a class="brand" href="/"><img src="/icon.svg" alt="">CookWell</a><h1>A little better.<br>Every single day.</h1><p>Food you enjoy. A kitchen you understand. A plan that grows with you.</p><div class="footer">Plan thoughtfully · cook confidently · live well</div></section><section class="auth-form"><p class="eyebrow">YOUR EVERYDAY FOOD COMPANION</p><h2>${authMode === "register" ? "Start with your kitchen." : authMode === "recover" ? "Recover your account." : "Welcome back."}</h2><p class="muted">${authMode === "register" ? "Your own space for meals, groceries and progress." : "Your plans and kitchen are saved here."}</p><form id="auth-form"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>${authMode === "recover" ? "New password" : "Password"}<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="${authMode === "login" ? "current-password" : "new-password"}"><span class="hint">At least 12 characters.</span></label>${authMode === "register" ? '<label>Invitation code<input name="invite" autocomplete="off"><span class="hint">Required on your deployed private app; optional locally.</span></label>' : ""}${authMode === "recover" ? '<label>Recovery code<input name="recovery" required autocomplete="off"></label>' : ""}<p class="error" role="alert"></p><button class="btn">${authMode === "register" ? "Create my account →" : authMode === "recover" ? "Reset password" : "Sign in →"}</button></form><div class="row section"><button class="link" data-action="auth-mode" data-mode="${authMode === "register" ? "login" : "register"}">${authMode === "register" ? "Already have an account? Sign in" : "Create an account"}</button>${authMode === "login" ? '<button class="link" data-action="auth-mode" data-mode="recover">Forgot password?</button>' : ""}</div></section></div>`;
}
const options = (values, current) =>
  values
    .map(
      ([v, l]) =>
        `<option value="${v}" ${String(current) === String(v) ? "selected" : ""}>${l}</option>`,
    )
    .join("");
const field = (label, name, type = "text", value = "", attrs = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const select = (label, name, values, current) =>
  `<label>${label}<select name="${name}">${options(values, current)}</select></label>`;
const features = createFeatures({
  getState: () => state,
  chosenPlan,
  mealInfo,
  modal,
  mutate,
  api,
  esc,
  field,
  select,
  btn,
  cash,
  toast,
  openMeal,
});
const sessionCooking = createSessionCooking({
  getState: () => state,
  chosenPlan,
  api,
  modal,
  esc,
  btn,
  toast,
  prepare: (id) => features.prepare(id),
});
const rhythmUI = createRhythmUI({
  getState: () => state,
  chosenPlan,
  modal,
  mutate,
  esc,
  btn,
  field,
  select,
  cash,
});
function renderOnboarding() {
  const p = state.profile || {},
    t = p.targets || {};
  onboardStep = 0;
  $("#app").innerHTML =
    `<main class="onboarding"><div class="onboarding-head"><a class="brand" href="/"><img src="/icon.svg" alt="">CookWell</a><span class="steps-label">A plan that fits your real life</span></div><div class="steps">${[0, 1, 2, 3, 4].map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}</div><form id="onboarding-form" novalidate>
 <section class="active" data-step="0"><p class="eyebrow">01 / YOUR ROUTINE</p><h1>Let's make room for real life.</h1><p class="intro">Tell us how you want to cook. You can change every answer later.</p><div class="fields">${field("Your name", "name", "text", p.name || "", 'required maxlength="60" autocomplete="given-name"')}${field("Weekly grocery budget (£)", "budget", "number", p.budget ? p.budget / 100 : 40, 'required min="5" max="500" step="0.01"')}${field("Postcode area (optional)", "postcode", "text", p.postcode || "", 'maxlength="30"')}${field("First week starts", "startDate", "date", p.startDate || localDay(), "required")}${select(
   "Cooking style",
   "cooking",
   [
     ["batch", "Batch cook for several meals"],
     ["daily", "Cook each meal fresh"],
   ],
   p.cooking || "batch",
 )}${select(
   "Active cooking time",
   "activeLimit",
   [
     [10, "Up to 10 minutes"],
     [20, "Up to 20 minutes"],
     [30, "Up to 30 minutes"],
     [60, "Up to an hour"],
   ],
   p.activeLimit || 20,
 )}</div><div class="notice">Your food budget covers full grocery packs. Eating out is a separate choice for any meal.</div></section>
 <section data-step="1"><p class="eyebrow">02 / YOUR KITCHEN</p><h1>What can you cook with?</h1><p class="intro">Select only what you own. Include cold storage so we can plan leftovers safely.</p><div class="checks">${[
   ["hob", "Hob / induction"],
   ["oven", "Oven"],
   ["microwave", "Microwave"],
   ["fridge", "Fridge"],
   ["freezer", "Freezer"],
   ["scales", "Kitchen scales"],
 ]
   .map(
     ([v, l]) =>
       `<label class="check-label"><input type="checkbox" name="equipment" value="${v}" ${p.equipment?.includes(v) ? "checked" : ""}>${l}</label>`,
   )
   .join(
     "",
   )}</div>${field("Hob rings available at once", "hobCount", "number", p.hobCount || 1, 'min="1" max="4" step="1" required')}${select(
   "Batch cooking interval",
   "cookEveryDays",
   [
     [3, "Every 3 days"],
     [2, "Every 2 days"],
   ],
   p.cookEveryDays || 3,
 )}${select(
   "Shopping interval",
   "shopEveryDays",
   [
     [7, "Once a week"],
     [3, "Every 3 days"],
     [2, "Every 2 days"],
   ],
   p.shopEveryDays || 7,
 )}<div class="notice">Recipes use grams and millilitres, including oil and sauces. A set of kitchen scales makes portioning easier. Batch meals need storage; freezing is offered when you have a freezer.</div></section>
 <section data-step="2"><p class="eyebrow">03 / TASTE & DISCOVERY</p><h1>Favourites, with room to explore.</h1><p class="intro">Likes guide discovery; allergies and ingredients you avoid are firm exclusions.</p><div class="fields">${select(
   "Diet",
   "diet",
   [
     ["omnivore", "I eat everything"],
     ["pescatarian", "Fish, but no meat"],
     ["vegetarian", "Vegetarian"],
     ["vegan", "Vegan"],
   ],
   p.diet || "omnivore",
 )}${select(
   "Discovery preference",
   "explore",
   [
     [0, "Lean towards familiar meals"],
     [1, "Some new recipes"],
     [2, "More new cuisines"],
     [3, "Keep exploring"],
   ],
   p.explore ?? 1,
 )}<div class="full">${field("Foods or cuisines you enjoy (optional)", "likes", "text", p.likes || "", 'placeholder="Something spicy, crunchy vegetables…" maxlength="200"')}</div><div class="full stack"><label>Allergies represented in our library</label><div class="checks">${["milk", "egg", "fish", "soy", "gluten", "peanut"].map((a) => `<label class="check-label"><input name="allergens" type="checkbox" value="${a}" ${p.allergens?.includes(a) ? "checked" : ""}>${a}</label>`).join("")}</div><small>For any other allergy, check every ingredient and product label; do not rely on this initial library for that allergy.</small><label>Ingredients to exclude<select name="avoid" multiple size="7">${state.ingredients.map((i) => `<option value="${i.id}" ${p.avoid?.includes(i.id) ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select><span class="hint">Select any number. Disliking plain milk doesn't have to exclude milk used inside recipes.</span></label></div></div></section>
 <section data-step="3"><p class="eyebrow">04 / ENERGY & GOALS</p><h1>A starting point for your progress.</h1><p class="intro">We'll estimate daily energy needs from your measurements. Adjust the target as you learn what works with your healthcare team.</p><div class="fields">${field("Age (18+)", "age", "number", p.age || "", 'required min="18" max="100"')}${field("Height (cm)", "height", "number", p.height || "", 'required min="120" max="230" step="0.1"')}${field("Weight (kg)", "weight", "number", p.weight || "", 'required min="35" max="300" step="0.1"')}${select(
   "Sex input for the energy equation",
   "equationSex",
   [
     ["", "Select an equation input"],
     ["male", "Male coefficient"],
     ["female", "Female coefficient"],
   ],
   p.equationSex || "",
 )}${select(
   "Usual activity",
   "activity",
   [
     [1.2, "Mostly sitting"],
     [1.375, "Lightly active"],
     [1.55, "Moderately active"],
     [1.725, "Very active"],
   ],
   p.activity || 1.2,
 )}${select(
   "Goal",
   "goal",
   [
     ["lose", "Gradual weight loss"],
     ["maintain", "Maintain weight"],
   ],
   p.goal || "lose",
 )}${field("Weight target (kg, optional override)", "targetWeight", "number", p.targetWeight || "", 'min="35" max="300" step="0.1"')}<p class="hint full" id="weight-preview"></p>${field("Daily steps goal", "stepsTarget", "number", p.stepsTarget || 7000, 'min="100" max="50000"')}<label>Daily calorie target (optional override)<input name="calorieTarget" type="number" min="1500" max="4500" value="${p.calorieTarget || ""}" placeholder="Calculated from your answers"><span class="hint" id="calorie-preview">Complete your measurements to see an estimate.</span></label></div><div class="notice">Uses the Mifflin–St Jeor equation and a modest 300 kcal reduction for weight loss. This estimate is for adults, not pregnancy, breastfeeding or a prescribed specialist diet. Discuss dietary changes with your diabetes team, especially if using glucose-lowering medication.</div></section>
 <section data-step="4"><p class="eyebrow">05 / YOUR GLUCOSE LOG</p><h1>Track what matters to you.</h1><p class="intro">Enter your meter's units and only the targets agreed with your clinician. Targets are optional and can be changed in Settings.</p><div class="fields">${select(
   "Meter units",
   "glucoseUnit",
   [
     ["mg/dL", "mg/dL"],
     ["mmol/L", "mmol/L"],
   ],
   p.glucoseUnit || "mg/dL",
 )}<div></div>${field("Before meal — minimum", "beforeMin", "number", t.before?.min ?? "", 'step="0.1" min="0.1" max="1000"')}${field("Before meal — maximum", "beforeMax", "number", t.before?.max ?? "", 'step="0.1" min="0.1" max="1000"')}${field("After meal — minimum", "afterMin", "number", t.after?.min ?? "", 'step="0.1" min="0.1" max="1000"')}${field("After meal — maximum", "afterMax", "number", t.after?.max ?? "", 'step="0.1" min="0.1" max="1000"')}</div><div class="notice">Food and activity tracking support your care plan. CookWell does not recommend medication changes or meals to treat a high reading. Your actual readings and weight start empty—no demo health data.</div></section>
 <p class="error section" role="alert"></p><div class="onboard-footer"><button type="button" class="btn outline" data-action="onboard-back">Back</button><button type="button" class="btn" data-action="onboard-next">Continue →</button></div></form></main>`;
  updateEstimate();
}
function updateEstimate() {
  const f = $("#onboarding-form");
  if (!f) return;
  const values = Object.fromEntries(new FormData(f));
  if (values.weight && values.height && values.age && values.equationSex) {
    const reference = weightReference(
      values.height,
      values.weight,
      values.goal,
    );
    $("#weight-preview").textContent =
      `BMI ${reference.bmi} · general adult reference ${reference.min}–${reference.max} kg. Suggested first milestone: ${reference.suggested} kg. Editable—not a single ideal weight.`;
    const bmr =
      10 * Number(values.weight) +
      6.25 * Number(values.height) -
      5 * Number(values.age) +
      (values.equationSex === "male" ? 5 : -161);
    const target = Math.max(
      1500,
      Math.round(
        (bmr * Number(values.activity) - (values.goal === "lose" ? 300 : 0)) /
          50,
      ) * 50,
    );
    $("#calorie-preview").textContent =
      `Suggested starting target: ${target} kcal/day. Includes a modest adjustment, not exercise calorie credits.`;
  }
}
async function nextOnboarding() {
  const f = $("#onboarding-form");
  for (const input of f.querySelectorAll(
    "section.active input,section.active select",
  )) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
  }
  if (onboardStep === 3 && !f.elements.equationSex.value) {
    showError(new Error("Select the equation input."));
    return;
  }
  if (onboardStep < 4) {
    onboardStep++;
    showOnboardStep();
    return;
  }
  const d = Object.fromEntries(new FormData(f));
  d.equipment = new FormData(f).getAll("equipment");
  d.allergens = new FormData(f).getAll("allergens");
  d.avoid = new FormData(f).getAll("avoid");
  d.targets = {
    before: { min: d.beforeMin, max: d.beforeMax },
    after: { min: d.afterMin, max: d.afterMax },
  };
  if (await mutate("profile", d)) {
    screen = "today";
    render();
    toast("Your kitchen is ready. Start by checking the shopping list.");
  }
}
function showOnboardStep() {
  document
    .querySelectorAll("[data-step]")
    .forEach((el) =>
      el.classList.toggle("active", Number(el.dataset.step) === onboardStep),
    );
  document
    .querySelectorAll(".steps span")
    .forEach((el, i) => el.classList.toggle("active", i <= onboardStep));
  $('[data-action="onboard-next"]').textContent =
    onboardStep === 4 ? "Save & create my plan →" : "Continue →";
  window.scrollTo(0, 0);
}
const navs = [
  ["today", "◒", "Today"],
  ["plan", "▦", "Plan"],
  ["kitchen", "⌑", "Kitchen"],
  ["recipes", "✳", "Recipes"],
  ["progress", "⌁", "Progress"],
  ["settings", "⚙", "Settings"],
];
function render() {
  if (!state) {
    renderAuth();
    return;
  }
  if (!state.profile) {
    renderOnboarding();
    return;
  }
  const p = state.profile;
  $("#app").innerHTML =
    `<div class="app-shell"><aside class="sidebar"><a class="brand" href="/"><img src="/icon.svg" alt="">CookWell</a><nav>${navs.map(([id, icon, label]) => `<button class="nav ${screen === id ? "active" : ""}" data-action="nav" data-screen="${id}"><span class="symbol">${icon}</span>${label}</button>`).join("")}</nav><div class="sidebar-foot"><strong>A little better, every day.</strong>One meal, one shop, one small step at a time.</div></aside><main class="main"><header class="topbar"><div><p class="eyebrow">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p><h1>${{ today: `Welcome back, ${esc(p.name)}.`, plan: "A week that works for you.", kitchen: "A little less waste.", recipes: "Find your next favourite.", progress: "Your own pace. Your progress.", settings: "Make yourself at home." }[screen]}</h1></div><button class="profile" data-action="nav" data-screen="settings" aria-label="Settings">${esc(p.name.slice(0, 2).toUpperCase())}</button></header><div id="screen">${{ today: renderToday, plan: renderPlan, kitchen: renderKitchen, recipes: renderRecipes, progress: renderProgress, settings: renderSettings }[screen]()}</div></main><nav class="mobile-nav" aria-label="Main navigation">${navs.map(([id, icon, label]) => `<button class="${screen === id ? "active" : ""}" data-action="nav" data-screen="${id}"><span class="symbol">${icon}</span>${label}</button>`).join("")}</nav></div>`;
  $("#screen").insertAdjacentHTML(
    "afterbegin",
    features.tools(screen) +
      sessionCooking.resumeButton() +
      rhythmUI.cards(screen),
  );
}
function totals(plan) {
  const rows =
      (shoppingTripDate
        ? plan?.shoppingTrips?.find((t) => t.date === shoppingTripDate)?.rows
        : null) ||
      plan?.shopping ||
      [],
    spent = state.purchases
      .filter((p) => p.planId === plan?.id)
      .reduce((n, p) => n + p.cost, 0),
    remaining = rows.reduce((n, r) => n + r.cost, 0);
  return { spent, remaining, total: spent + remaining };
}
function mealCard(m) {
  const r = catalog()[m.recipeId],
    b = state.batches.find((b) => b.id === m.batchId);
  return `<article class="meal"><p class="eyebrow">${slotNames[m.slot]}</p><h3>${m.status === "out" ? "Eating out" : m.status === "skipped" ? "Skipped" : esc(r.title)}</h3><small>${m.status === "eaten" ? "✓ Eaten" : m.parentId ? "Planned leftover" : b ? "Prepared" : `${r.active} min active`} · ${Math.round(r.nutrition.kcal * m.multiplier)} kcal planned</small><div class="actions"><button class="link" data-action="meal" data-id="${m.id}">View meal →</button>${m.status === "planned" ? `<button class="link" data-action="swap" data-id="${m.id}">Change</button>` : ""}</div></article>`;
}
function actionCenter(plan) {
  const items = actionItems(state, plan, localDay());
  if (!items.length) return "";
  return `<section class="section action-center"><div class="section-head"><div><p class="eyebrow">TODAY'S ACTIONS</p><h2>What needs your attention.</h2></div><span class="badge">${items.length} item${items.length === 1 ? "" : "s"}</span></div><div class="action-list">${items
    .map(
      (item) =>
        `<article class="action-item priority-${item.priority}"><span class="action-dot" aria-hidden="true"></span><div><h3>${esc(item.title)}</h3><small>${esc(item.detail)}</small></div><button class="link" data-action="${item.action}" ${item.target ? `data-id="${esc(item.target)}"` : ""} ${item.screen ? `data-screen="${esc(item.screen)}"` : ""}>${esc(item.label)} →</button></article>`,
    )
    .join("")}</div></section>`;
}
function renderToday() {
  const plan = chosenPlan(),
    items = plan?.meals.filter((m) => m.date === localDay()) || [],
    next =
      items.find((m) => m.status === "planned") ||
      plan?.meals.find((m) => m.date >= localDay() && m.status === "planned"),
    r = next ? catalog()[next.recipeId] : null,
    t = totals(plan),
    p = state.profile;
  const expiring = state.inventory.filter(
    (i) => i.quantity > 0 && i.expires && i.expires <= addDays(localDay(), 3),
  );
  return `<div class="hero"><article class="hero-main"><p class="eyebrow">${next ? slotNames[next.slot] + " · " + dateLabel(next.date) : "YOUR NEXT CHAPTER"}</p><h2>${r ? esc(r.title) : "Make space for a good week."}</h2><p>${next?.parentId ? "A portion from your batch. Check Kitchen before preparing something new." : "Your plan takes your kitchen, time and preferences into account."}</p><div class="row">${r ? `<span class="badge dark">${esc(r.cuisine)}</span><span class="badge dark">${r.active} min active</span>` : ""}</div><div class="row">${next ? btn("Open recipe →", "meal", `data-id="${next.id}"`, "light") : btn("Plan my week →", "nav", 'data-screen="plan"', "light")}</div><img src="/icon.svg" class="hero-art" alt=""></article><article class="card budget-card"><div class="row between"><p class="eyebrow">WEEKLY GROCERIES</p><button class="link" data-action="budget">Details →</button></div><p class="budget-amount">${cash(t.total)}</p><small>spent + still needed / ${cash(p.budget)} budget</small><div class="bar"><i style="width:${Math.min(100, (t.total / p.budget) * 100)}%"></i></div><p>${cash(Math.abs(p.budget - t.total))} ${t.total > p.budget ? "over budget" : "remaining"}</p><small>Full packs counted. ${cash(t.spent)} purchased.</small><small>Price estimates are labelled; check retailer packs.</small>${t.total > p.budget ? '<span class="badge warn">Review quantities or swap meals</span>' : ""}</article></div>${actionCenter(plan)}${dailyCard(state, localDay(), true)}<section class="section"><div class="section-head"><div><p class="eyebrow">TODAY'S MENU</p><h2>Four small moments to eat well.</h2></div><button class="link" data-action="nav" data-screen="plan">Full week →</button></div>${items.length ? `<div class="meal-grid">${items.map(mealCard).join("")}</div>` : empty("No meals for today", "Open Plan to create a week covering today.")}</section><section class="section grid2"><article class="card"><p class="eyebrow">YOUR KITCHEN FIRST</p><h2>Use what you have.</h2>${
    expiring.length
      ? expiring
          .slice(0, 3)
          .map(
            (i) =>
              `<div class="list-row"><div>${esc(state.ingredients.find((x) => x.id === i.ingredientId).name)}<small class="source">${i.expires < localDay() ? "Past recorded use-by" : "Use by " + dateLabel(i.expires)}</small></div><button class="link" data-action="stock" data-id="${i.id}">Update</button></div>`,
          )
          .join("")
      : '<p class="muted section">No ingredients nearing their recorded expiry.</p>'
  }<button class="link section" data-action="nav" data-screen="kitchen">Open kitchen →</button></article><article class="card" style="background:#eef0de"><p class="eyebrow">A QUICK CHECK-IN</p><h2>How are you doing?</h2><p class="muted section">Build a picture over time, one entry at a time.</p><div class="row section">${btn("+ Glucose", "log", 'data-type="glucose"', "light")}${btn("+ Weight", "log", 'data-type="weight"', "light")}${btn("+ Steps", "log", 'data-type="steps"', "light")}</div></article></section>`;
}
function renderPlan() {
  const plan = chosenPlan();
  if (!plan)
    return empty(
      "Your first week is waiting",
      "Complete your profile to generate meals.",
    );
  const t = totals(plan);
  return `<div class="week-toolbar"><select id="plan-select" aria-label="Select week">${state.plans.map((p) => `<option value="${p.id}" ${p.id === plan.id ? "selected" : ""}>${dateLabel(p.start)} – ${dateLabel(addDays(p.start, 6))} · ${p.status}</option>`).join("")}</select>${btn("Next week draft →", "next-week")}${btn("Shopping list", "nav", 'data-screen="kitchen"', "outline")}</div>${plan.status === "draft" ? `<div class="notice row between"><div><strong>Draft ready for review.</strong><p>Check quantities and use-by dates in Kitchen, then confirm this week.</p></div>${btn("Stock checked · confirm week", "activate", `data-id="${plan.id}"`)}</div>` : ""}<div class="row section-head"><span class="badge">28 meal slots</span><span class="badge">${state.profile.cooking === "batch" ? "Batch cooking" : "Fresh cooking"}</span><span class="badge ${t.total > state.profile.budget ? "warn" : ""}">${cash(t.total)} / ${cash(state.profile.budget)}</span></div><div class="week">${Array.from(
    { length: 7 },
    (_, i) => {
      const date = addDays(plan.start, i),
        ms = plan.meals.filter((m) => m.date === date);
      return `<article class="day"><div><p class="eyebrow">${new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}</p><div class="day-date">${dateLabel(date)}</div></div>${ms
        .map((m) => {
          const r = catalog()[m.recipeId];
          return `<div class="day-slot ${m.status}"><p class="eyebrow">${slotNames[m.slot]}</p><h3>${m.status === "out" ? "Eating out" : m.status === "skipped" ? "Skipped" : esc(r.title)}</h3><small>${m.status === "eaten" ? "✓ Eaten" : m.parentId ? "↳ Leftover portion" : r.cuisine} · ${Math.round(r.nutrition.kcal * m.multiplier)} kcal</small><div class="row"><button class="link" data-action="meal" data-id="${m.id}">View</button>${m.status === "planned" ? `<button class="link" data-action="swap" data-id="${m.id}">Change</button>` : ""}</div></div>`;
        })
        .join(
          "",
        )}<small>${Math.round(ms.filter((m) => !["out", "skipped"].includes(m.status)).reduce((n, m) => n + catalog()[m.recipeId].nutrition.kcal * m.multiplier, 0))} kcal planned</small></article>`;
    },
  ).join(
    "",
  )}</div><div class="notice section">Your energy target is ${state.profile.calorieTarget} kcal/day. Meals are portioned towards it; check daily totals. Eating-out meals are not included in nutrition totals. A new weekly draft appears when you open the app near the end of an active week.</div>`;
}
function renderKitchen() {
  const plan = chosenPlan(),
    rows = plan?.shopping || [],
    t = totals(plan),
    byGroup = {};
  for (const r of rows) (byGroup[r.group] ??= []).push(r);
  return `<div class="section-head"><div><p class="eyebrow">${plan ? dateLabel(plan.start) + " – " + dateLabel(addDays(plan.start, 6)) : "YOUR KITCHEN"}</p><h2>From shopping bag to dinner.</h2><p>${cash(t.spent)} purchased · ${cash(t.remaining)} still needed</p></div>${btn("+ Add stock", "stock")}</div><div class="notice">Prices include full packs and edible quantities (e.g. 240 g drained chickpeas per can). Retailer snapshots have a source and date; other prices are estimates. Update the price or nutrition from the pack you buy.</div><div class="grid2 section"><section><h2>Shopping list</h2><label>Shopping trip<select id="shopping-trip">${options([["", "Whole week"], ...(plan?.shoppingTrips || []).map((t) => [t.date, t.date + " · through " + t.through + " · " + cash(t.total)])], shoppingTripDate)}</select></label>${shoppingTripDate ? '<p class="hint">This trip only. Later trips assume earlier purchases and ingredient use; review before buying.</p>' : ""}${Object.entries(
    byGroup,
  )
    .map(
      ([g, rs]) =>
        `<div class="section"><p class="eyebrow">${esc(g)}</p>${rs.map((r) => `<article class="shop-line"><div><h3>${esc(r.name)}</h3><small>Need ${r.need} ${r.unit} · ${r.have} ${r.unit} available</small><small>${r.packs ? `${r.packs} × ${r.price.pack} ${r.unit} packs` : "Covered by your kitchen"}</small><div class="price-status">${esc(r.price.source)}${r.price.checkedAt ? " · " + r.price.checkedAt : ""}</div><div class="row"><button class="link" data-action="price" data-id="${r.id}">Edit price</button><button class="link" data-action="nutrition-edit" data-id="${r.id}">Pack nutrition</button>${r.price.url ? `<a class="link" href="${esc(r.price.url)}" target="_blank" rel="noreferrer">Source ↗</a>` : ""}</div></div><span class="cost">${cash(r.cost)}</span>${r.packs ? btn("Bought", "purchase", `data-id="${r.id}"`, "soft") : '<span class="badge">In stock</span>'}</article>`).join("")}</div>`,
    )
    .join(
      "",
    )}</section><section class="stack"><div><h2>My ingredients</h2><p class="muted">Actual quantities left. Update after waste or a stock check.</p></div>${
    state.inventory
      .filter((i) => i.quantity > 0)
      .map((i) => {
        const ing = state.ingredients.find((x) => x.id === i.ingredientId);
        return `<article class="inventory-item"><h3>${esc(ing.name)}</h3><small>${round(i.quantity)} ${ing.unit} · ${i.location}</small><small>${i.expires ? (i.expires < localDay() ? "Past use-by · " : "Use by ") + i.expires : "No expiry recorded — check the pack"}</small><button class="link" data-action="stock" data-id="${i.id}">Adjust quantity / storage</button></article>`;
      })
      .join("") ||
    empty(
      "Start with your cupboards",
      "Add ingredients you already have, or confirm a purchase.",
    )
  }<h2 class="section">Cooked portions</h2>${
    state.batches
      .filter((b) => b.remaining > 0)
      .map(
        (b) =>
          `<article class="inventory-item"><h3>${esc(catalog()[b.recipeId].title)}</h3><small>${b.remaining} portions · ${b.location} · use by ${b.safeUntil ? new Date(b.safeUntil).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" }) + " UK" : b.expires}</small><small>${portionDescription(b)}</small><div class="row">${btn("Record batch weight", "batch-weight", `data-id="${b.id}"`, "outline")}${btn(b.location === "freezer" ? "Confirm defrosted" : "Freeze", "batch", `data-id="${b.id}" data-op="${b.location === "freezer" ? "thaw" : "freeze"}"`, "soft")}${btn("Use in plan", "use-batch-dialog", `data-id="${b.id}"`, "outline")}${btn("Record waste", "batch", `data-id="${b.id}" data-op="waste"`, "outline")}</div></article>`,
      )
      .join("") || '<p class="muted">Prepared meals will appear here.</p>'
  }</section></div>`;
}
function renderRecipes() {
  return `<div class="section-head"><div><p class="eyebrow">EXPLORE & LEARN</p><h2>A library for your real kitchen.</h2><p>Recipes shown meet your saved equipment, diet and ingredient exclusions.</p></div></div><form id="search-form" class="row"><input class="search" style="margin:0;flex:1" name="query" placeholder="Something spicy using beans…" aria-label="Find a recipe">${btn("Find ideas", "search-recipes")}</form><p class="hint" style="margin-top:8px">Ingredient and cuisine search works free. No paid AI service is enabled.</p><div id="recommendations"></div><div class="recipes section">${state.catalog
    .filter((r) => r.allowed)
    .map(recipeCard)
    .join("")}</div>`;
}
function recipeCard(r) {
  return `<article class="recipe"><div class="recipe-header"><span class="eyebrow" style="margin:0">${esc(r.cuisine)}</span><span class="recipe-icon">✳</span></div><div class="recipe-body"><h3>${esc(r.title)}</h3><small>${r.active} min active · ${Math.round(r.nutrition.kcal)} kcal / base serving</small><span class="hint">${round(r.nutrition.protein)} g protein · ${round(r.nutrition.fibre)} g fibre</span>${btn("View recipe →", "recipe", `data-id="${r.id}"`, "outline")}</div></article>`;
}
function lineChart(logs, unit) {
  if (logs.length < 2)
    return empty(
      "A trend needs a little time",
      "Log at least two entries to see a chart.",
    );
  const vals = logs.slice(-14),
    lo = Math.min(...vals.map((l) => l.value)),
    hi = Math.max(...vals.map((l) => l.value));
  const points = vals.map((l, i) => [
    20 + (i * 340) / (vals.length - 1),
    105 - ((l.value - lo) / (hi - lo || 1)) * 75,
  ]);
  return `<svg class="chart" role="img" aria-label="${esc(unit)} trend across ${vals.length} readings" viewBox="0 0 390 150"><path d="${points.map(([x, y], i) => (i ? "L" : "M") + x + "," + y).join(" ")}"/>${points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3"><title>${vals[i].date}: ${vals[i].value} ${unit}</title></circle>`).join("")}<text x="20" y="140">${dateLabel(vals[0].date)}</text><text x="290" y="140">${dateLabel(vals.at(-1).date)}</text><text x="20" y="15">${lo} – ${hi} ${esc(unit)}</text></svg>`;
}
function renderProgress() {
  const logs = [...state.logs].sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time),
    ),
    weights = logs.filter((l) => l.type === "weight"),
    steps = logs.filter((l) => l.type === "steps" && l.date === localDay()),
    glucose = logs.filter((l) => l.type === "glucose"),
    eaten = state.plans
      .flatMap((p) => p.meals)
      .filter((m) => m.status === "eaten" && dayKey(m.eatenAt) === localDay());
  const actual = {};
  for (const m of eaten)
    for (const [k, v] of Object.entries(m.actualNutrition || {}))
      actual[k] = (actual[k] || 0) + v;
  const units = state.profile.glucoseUnit,
    converted = glucose.map((l) => ({
      ...l,
      value: round(
        l.value * (l.unit === units ? 1 : units === "mg/dL" ? 18 : 1 / 18),
      ),
    }));
  return `<div class="section-head"><div><p class="eyebrow">PROGRESS, WITH CONTEXT</p><h2>Build your own picture.</h2></div>${btn("+ Add a measurement", "log", 'data-type="weight"')}</div><div class="stats">${[
    [
      "Latest weight",
      weights.length ? weights.at(-1).value + " kg" : "—",
      weights.length ? dateLabel(weights.at(-1).date) : "No readings yet",
    ],
    [
      "Steps today",
      steps.length ? steps.at(-1).value.toLocaleString() : "—",
      "Goal " + state.profile.stepsTarget.toLocaleString(),
    ],
    ["Glucose readings", glucose.length, "All recorded measurements"],
    [
      "Eaten today",
      eaten.length + " meals",
      Math.round(actual.kcal || 0) + " kcal recorded",
    ],
  ]
    .map(
      ([l, v, n]) =>
        `<article class="stat"><p class="eyebrow">${l}</p><div class="value">${v}</div><small>${n}</small></article>`,
    )
    .join(
      "",
    )}</div><div class="grid2 section"><article class="card"><p class="eyebrow">WEIGHT</p><h2>Your recorded trend</h2>${lineChart(weights, "kg")}</article><article class="card"><p class="eyebrow">GLUCOSE</p><h2>Readings in ${units}</h2>${lineChart(converted, units)}<small>Chart converts units for comparison. Original values stay in your log. Timing, meals and activity affect readings.</small></article></div>${dailyCard(state, intakeDate)}${weightCard(state)}<section class="section card"><div class="section-head"><h2>Measurement history</h2><a class="link" href="/api/index?action=export">Export my data ↓</a></div>${
    logs.length
      ? logs
          .slice()
          .reverse()
          .slice(0, 50)
          .map((l) => {
            let outside = false;
            if (l.type === "glucose" && state.profile.targets[l.timing]) {
              const n =
                  l.value *
                  (l.unit === units ? 1 : units === "mg/dL" ? 18 : 1 / 18),
                t = state.profile.targets[l.timing];
              outside =
                (t.min != null && n < t.min) || (t.max != null && n > t.max);
            }
            return `<div class="list-row"><div><strong>${esc(l.type)} · ${l.value}${l.diastolic ? "/" + l.diastolic : ""} ${esc(l.unit)}</strong><small class="source">${l.date} ${esc(l.time)} ${l.timing ? "· " + l.timing : ""}${l.minutesAfter ? " · " + l.minutesAfter + " min after meal" : ""}</small>${l.note ? `<small>${esc(l.note)}</small>` : ""}${outside ? '<div class="notice warning">Outside your saved target. Follow your care plan and contact your diabetes team if concerned or unwell.</div>' : ""}</div><button class="link" data-action="delete-log" data-id="${l.id}">Delete</button></div>`;
          })
          .join("")
      : empty(
          "Your first entry starts the story",
          "Weight, glucose, steps, sleep, energy, workouts and more.",
        )
  }</section>`;
}
function renderSettings() {
  const p = state.profile;
  return `<div class="settings-list"><article class="card"><p class="eyebrow">YOUR PROFILE</p><h2>${esc(p.name)}'s preferences</h2><p class="section">${cash(p.budget)} / week · ${p.cooking === "batch" ? "Batch cooking" : "Fresh cooking"} · ${p.activeLimit} active minutes</p><p class="muted">${p.equipment.map(esc).join(", ") || "No cooking equipment selected"} · ${p.diet}</p><div class="row section">${btn("Edit onboarding & goals", "onboarding")}${btn("Sign out", "logout", "", "outline")}</div></article><article class="card"><p class="eyebrow">ENERGY ESTIMATE</p><h2>${p.calorieTarget} kcal / day</h2><p class="section muted">Estimated maintenance: ${p.energy.maintenance} kcal. ${esc(p.energy.method)}</p><p class="hint section">These estimates are not medical prescriptions. Your care team can help set an appropriate target.</p><a class="link" href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">Energy equation source ↗</a></article><article class="card"><p class="eyebrow">DATA & PRIVACY</p><h2>Your account, your records.</h2><p class="section muted">Saved on the app's server. Health records are not cached offline. The home-screen app needs an internet connection.</p><div class="row section"><a class="btn outline" href="/api/index?action=export">Export my records</a>${btn("Delete account", "delete-account", "", "danger")}</div></article><article class="card"><p class="eyebrow">PRICE & RECIPE SOURCES</p><h2>Know what each number means.</h2><p class="section muted">Nutrition is calculated from raw, dry or drained ingredient quantities, with editable per-100 g/ml pack values. Generic values are estimates. Prices are dated snapshots or your own confirmed pack prices, never a promise of live stock. No paid AI is connected.</p><a href="https://www.food.gov.uk/safety-hygiene/home-food-fact-checker" class="link" target="_blank" rel="noreferrer">Food storage guidance ↗</a></article></div>`;
}
async function openRecipe(id, mult = 1, meal = null) {
  const r = await api(`recipe&id=${encodeURIComponent(id)}&multiplier=${mult}`);
  activeRecipe = r;
  activeMeal = meal;
  const info = meal ? mealInfo(meal.id) : {},
    b = info.batch;
  modal(
    `<p class="eyebrow">${esc(r.cuisine)} · ${r.active} MIN ACTIVE</p><h2>${esc(r.title)}</h2><p class="intro">${meal ? "Quantities below cover this meal or its entire batch." : "Base serving; add through a meal swap to put this recipe on your plan."} All nutrition is estimated from ingredient quantities.</p>${meal ? features.batchSummary(meal) : ""}${nutrition(r.nutrition)}<p class="hint">${meal && mult !== meal.multiplier ? "Nutrition shown for the whole batch. Each planned portion has its own allocation." : "Nutrition shown for the displayed quantities."}</p><h3 class="section">Exactly what to use</h3>${r.ingredients.map((i) => `<div class="ingredient"><strong>${i.quantity} ${i.unit}</strong><div>${esc(i.name)}<small class="source">${esc(i.nutritionSource)}</small></div></div>`).join("")}<div class="row section">${btn("Start step-by-step cooking →", "guided")}</div><details><summary>Read all cooking steps</summary><ol class="step-list">${r.steps.map((st) => `<li><h3>${esc(st.title)}</h3>${instructionList(st.text)}</li>`).join("")}</ol></details><div class="row section">${btn("Guided cooking →", "guided")}${meal && !b && meal.status === "planned" ? btn("Mark prepared", "prepare", `data-id="${meal.id}"`, "outline") : ""}${meal && b && meal.status !== "eaten" ? btn("Mark this portion eaten", "eat", `data-id="${meal.id}"`) : ""}${btn("Rate this recipe", "feedback", `data-id="${r.id}"`, "outline")}</div>${meal ? `<div class="row section">${btn("Eating out instead", "meal-status", `data-id="${meal.id}" data-status="out"`, "soft")}${btn("Skip this meal", "meal-status", `data-id="${meal.id}" data-status="skipped"`, "soft")}${meal.status === "out" || meal.status === "skipped" ? btn("Restore meal", "meal-status", `data-id="${meal.id}" data-status="planned"`, "outline") : ""}</div>` : ""}`,
  );
}
async function openMeal(id) {
  const { m, p, batch } = mealInfo(id);
  if (m.parentId && !batch) {
    const parent = p.meals.find((x) => x.id === m.parentId);
    modal(
      `<p class="eyebrow">PLANNED LEFTOVER</p><h2>This portion comes from a batch.</h2><p class="intro">Prepare ${esc(catalog()[m.recipeId].title)} in the cooking session on ${dateLabel(parent.cookDate || parent.date)} first.</p>${btn("Open original batch →", "meal", `data-id="${parent.id}"`)}`,
    );
    return;
  }
  const mult = batch ? m.multiplier : yieldInfo(p, m).multiplier;
  await openRecipe(m.recipeId, mult, m);
}
function swapDialog(id) {
  const { m, r } = mealInfo(id);
  const candidates = state.catalog.filter(
    (x) => x.allowed && x.slots.includes(m.slot) && x.id !== r.id,
  );
  modal(
    `<p class="eyebrow">CHANGE ${slotNames[m.slot]}</p><h2>What sounds good instead?</h2><p class="intro">Shopping quantities and remaining pack costs update when you choose. Completed meals stay intact.</p><div class="stack">${candidates.map((x) => `<div class="list-row"><div><h3>${esc(x.title)}</h3><small>${x.cuisine} · ${x.active} min active</small></div>${btn("Choose", "choose-swap", `data-id="${id}" data-recipe="${x.id}"`, "soft")}</div>`).join("") || empty("No other matching recipes", "Your ingredient exclusions remain in place.")}</div>`,
  );
}
function stockDialog(id) {
  const item = state.inventory.find((i) => i.id === id);
  modal(
    `<p class="eyebrow">KITCHEN STOCK</p><h2>${item ? "Update your ingredient" : "What do you already have?"}</h2><form id="stock-form" data-id="${item?.id || ""}">${select(
      "Ingredient",
      "ingredientId",
      state.ingredients.map((i) => [i.id, i.name]),
      item?.ingredientId,
    )}${field("Edible quantity (g or ml, as named in ingredient)", "quantity", "number", item?.quantity ?? "", 'required min="0" max="100000" step="0.1"')}${select(
      "Where is it stored?",
      "location",
      [
        ["cupboard", "Cupboard"],
        ["fridge", "Fridge"],
        ["freezer", "Freezer"],
      ],
      item?.location || "cupboard",
    )}${field("Use-by date on pack (optional)", "expires", "date", item?.expires || "")}<span class="hint">Use drained weight for canned beans. Set quantity to zero to record waste or finish an item.</span><button class="btn">Save stock</button></form>`,
  );
}
function priceDialog(id) {
  const i = state.ingredients.find((i) => i.id === id),
    p = state.prices[id] || i;
  modal(
    `<p class="eyebrow">PACK PRICE</p><h2>${esc(i.name)}</h2><form id="price-form" data-id="${id}">${field("Retailer / source", "retailer", "text", p.source, 'required maxlength="70"')}${field("Price per pack (£)", "price", "number", p.price / 100, 'required min="0" max="1000" step="0.01"')}${field("Edible quantity per pack (" + i.unit + ")", "pack", "number", p.pack, 'required min="1" max="100000"')}<p class="hint">For tins, use drained edible quantity. The date is recorded when you save.</p><button class="btn">Update price</button></form>`,
  );
}
function purchaseDialog(id) {
  const p = chosenPlan();
  const r = (
    (shoppingTripDate
      ? p.shoppingTrips?.find((t) => t.date === shoppingTripDate)?.rows
      : null) || p.shopping
  ).find((i) => i.id === id);
  modal(
    `<p class="eyebrow">CONFIRM PURCHASE</p><h2>${esc(r.name)}</h2><form id="purchase-form" data-id="${id}">${field("Packs bought", "packs", "number", r.packs, 'required min="1" max="100" step="1"')}${field("Use-by date on pack (optional)", "expires", "date", "", "")}${select(
      "Storage",
      "location",
      [
        ["cupboard", "Cupboard"],
        ["fridge", "Fridge"],
        ["freezer", "Freezer"],
      ],
      ["Protein", "Produce", "Chilled"].includes(r.group)
        ? "fridge"
        : r.group === "Frozen"
          ? "freezer"
          : "cupboard",
    )}<p class="hint">${r.price.pack} ${r.unit} per pack · ${cash(r.price.price)} each. Update the price first if you paid differently.</p><button class="btn">Add to Kitchen & spending</button></form>`,
  );
}
function logDialog(type = "weight") {
  modal(
    `<p class="eyebrow">YOUR CHECK-IN</p><h2>Record a measurement.</h2><form id="log-form">${select(
      "Measure",
      "type",
      [
        ["weight", "Weight"],
        ["glucose", "Blood glucose"],
        ["steps", "Steps"],
        ["workout", "Workout energy"],
        ["waist", "Waist"],
        ["sleep", "Sleep"],
        ["energy", "Energy / mood"],
        ["hba1c", "HbA1c"],
        ["bloodPressure", "Blood pressure"],
      ],
      type,
    )}<div id="measure-fields"></div>${field("Date", "date", "date", localDay(), "required")}${field("Time", "time", "time", new Date().toTimeString().slice(0, 5), "required")}<label>Context (optional)<textarea name="note" maxlength="200" placeholder="Meal, sleep, activity, how you felt…"></textarea></label><button class="btn">Save measurement</button></form>`,
  );
  measureFields(type);
}
function measureFields(type) {
  const labels = {
    weight: "Weight (kg)",
    glucose: "Meter reading",
    steps: "Total daily steps",
    workout: "Workout energy (kcal)",
    waist: "Waist (cm)",
    sleep: "Hours slept",
    energy: "Energy (1–5)",
    hba1c: "HbA1c result",
    bloodPressure: "Systolic (mmHg)",
  };
  $("#measure-fields").innerHTML =
    `<div class="stack">${field(labels[type], "value", "number", "", 'required min="0" step="0.1"')}${
      type === "glucose"
        ? select(
            "Unit",
            "unit",
            [
              ["mg/dL", "mg/dL"],
              ["mmol/L", "mmol/L"],
            ],
            state.profile.glucoseUnit,
          ) +
          select(
            "Timing",
            "timing",
            [
              ["before", "Before meal"],
              ["after", "After meal"],
              ["fasting", "Fasting"],
              ["other", "Other"],
            ],
            "before",
          ) +
          field(
            "Minutes after eating (only for after-meal readings)",
            "minutesAfter",
            "number",
            120,
            'min="1" max="1440"',
          )
        : ""
    }${
      type === "hba1c"
        ? select(
            "Unit",
            "unit",
            [
              ["mmol/mol", "mmol/mol"],
              ["%", "%"],
            ],
            "mmol/mol",
          )
        : ""
    }${type === "bloodPressure" ? field("Diastolic (mmHg)", "diastolic", "number", "", 'required min="20" max="200"') : ""}</div>`;
}
async function searchRecipes() {
  const query = $("#search-form input").value;
  const result = await api("recommend", { query, slot: "dinner" });
  $("#recommendations").innerHTML =
    `<div class="notice section"><strong>Ideas from your library</strong><div class="stack">${result.recipes.map((r) => `<div class="list-row"><div>${esc(r.title)}<small class="source">${r.uses.length ? "Uses your " + esc(r.uses.join(", ")) : "Fits your equipment and exclusions"}</small></div>${btn("View", "recipe", `data-id="${r.id}"`, "light")}</div>`).join("")}</div></div>`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = b.dataset.id;
  e.preventDefault();
  try {
    if (await sessionCooking.click(a, id, b)) return;
    if (rhythmUI.click(a, id, b)) return;
    if (a === "guided") {
      await sessionCooking.single(activeRecipe, activeMeal);
      return;
    }
    if (await features.click(a, id, b)) return;
    if (a === "auth-mode") {
      authMode = b.dataset.mode;
      renderAuth();
    }
    if (a === "close") closeDialog();
    if (a === "nav") {
      screen = b.dataset.screen;
      render();
      window.scrollTo(0, 0);
    }
    if (a === "onboarding") renderOnboarding();
    if (a === "onboard-next") await nextOnboarding();
    if (a === "onboard-back") {
      if (onboardStep) {
        onboardStep--;
        showOnboardStep();
      } else if (state.profile) render();
    }
    if (a === "logout") {
      await api("logout", {});
      sessionCooking.reset();
      state = null;
      authMode = "login";
      renderAuth();
    }
    if (a === "meal") await openMeal(id);
    if (a === "recipe") await openRecipe(id);
    if (a === "swap") swapDialog(id);
    if (a === "choose-swap") {
      if (await mutate("swap", { id, recipeId: b.dataset.recipe }))
        toast("Meal changed. Shopping list recalculated.");
    }
    if (a === "meal-status") {
      if (await mutate("mealStatus", { id, status: b.dataset.status }))
        toast("Plan and shopping list updated.");
    }
    if (a === "next-week") {
      const start = addDays(chosenPlan().start, 7);
      if (await mutate("generate", { start, draft: true })) {
        planId = state.plans.find((p) => p.start === start).id;
        render();
        toast("Draft created. Check Kitchen before confirming.");
      }
    }
    if (a === "activate") {
      await mutate("activate", { id });
      toast("Week confirmed.");
    }
    if (a === "stock") stockDialog(id);
    if (a === "price") priceDialog(id);
    if (a === "purchase") purchaseDialog(id);
    if (a === "nutrition-edit") {
      const i = state.ingredients.find((i) => i.id === id),
        n = state.nutrition[id] || i.nutrition;
      modal(
        `<p class="eyebrow">NUTRITION FROM YOUR PACK</p><h2>${esc(i.name)}</h2><p class="intro">Per 100 ${i.unit}, in the same raw/dry/drained state as the recipe. Prepared-food labels cannot be used for dry ingredients.</p><form id="nutrition-form" data-id="${id}"><div class="fields">${Object.entries(
          n,
        )
          .map(([k, v]) =>
            field(
              k + (k === "kcal" ? "" : " (g)"),
              "nut-" + k,
              "number",
              v,
              'min="0" max="1000" step="0.01" required',
            ),
          )
          .join(
            "",
          )}</div><button class="btn">Save label values</button></form>`,
      );
    }
    if (a === "budget") {
      const t = totals(chosenPlan());
      modal(
        `<p class="eyebrow">YOUR WEEK'S GROCERIES</p><h2>${cash(t.total)} of ${cash(state.profile.budget)}</h2><div class="list-row"><span>Purchased</span><strong>${cash(t.spent)}</strong></div><div class="list-row"><span>Remaining full packs</span><strong>${cash(t.remaining)}</strong></div><div class="list-row"><span>${t.total > state.profile.budget ? "Over budget" : "Unallocated budget"}</span><strong>${cash(Math.abs(state.profile.budget - t.total))}</strong></div><p class="intro section">Eating out is separate. Estimates and retailer snapshots aren't guaranteed prices. Your confirmed prices replace them for later plans.</p>${btn("Open shopping list", "budget-shop")}`,
      );
    }
    if (a === "budget-shop") {
      closeDialog();
      screen = "kitchen";
      render();
    }
    if (a === "prepare") prepareDialog(id);

    if (a === "feedback") {
      modal(
        `<p class="eyebrow">HELP YOUR PLAN LEARN</p><h2>Would you make it again?</h2><form id="feedback-form" data-id="${id}">${select(
          "Your verdict",
          "rating",
          [
            ["love", "Yes, loved it"],
            ["okay", "It was okay"],
            ["dislike", "Not for me"],
          ],
          "love",
        )}${select(
          "Effort",
          "effort",
          [
            ["easy", "Easy"],
            ["right", "About right"],
            ["hard", "Too much work"],
          ],
          "right",
        )}${field("Spice, texture, fullness or other notes", "note")}<button class="btn">Save feedback</button></form>`,
      );
    }
    if (a === "log") logDialog(b.dataset.type);
    if (a === "food-log") foodDialog();
    if (a === "delete-food")
      modal(
        `<h2>Remove this food entry?</h2><p class="intro">This adjusts your recorded calories and nutrients for that day.</p>${btn("Remove entry", "confirm-delete-food", `data-id="${id}"`, "danger")}`,
      );
    if (a === "confirm-delete-food") await mutate("deleteFood", { id });
    if (a === "delete-log") {
      modal(
        `<h2>Delete this measurement?</h2><p class="intro">It will be removed from the log and charts.</p>${btn("Delete measurement", "confirm-delete-log", `data-id="${id}"`, "danger")}`,
      );
    }
    if (a === "confirm-delete-log") await mutate("deleteLog", { id });
    if (a === "delete-account")
      modal(
        `<h2>Delete your account?</h2><p class="intro">This permanently deletes your meals, stock, purchases and health records. Export them from Settings first if you want a copy.</p><form id="delete-account-form">${field("Confirm password", "password", "password", "", "required")}<button class="btn danger">Permanently delete account</button></form>`,
      );
    if (a === "search-recipes") await searchRecipes();
  } catch (error) {
    showError(error);
  }
});
function prepareDialog(id) {
  features.prepare(id);
}
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    d = Object.fromEntries(new FormData(f)),
    id = f.dataset.id;
  const submit = f.querySelector("button[type=submit],button:not([type])");
  if (submit) submit.disabled = true;
  try {
    if (sessionCooking.submit(f, d)) return;
    if (await rhythmUI.submit(f, d)) return;
    if (await features.submit(f, d)) return;
    if (f.id === "auth-form") {
      const result = await api(authMode, d);
      sessionCooking.reset();
      state = result.state;
      render();
      if (result.recoveryCode)
        modal(
          `<p class="eyebrow">SAVE THIS SOMEWHERE SAFE</p><h2>Your account recovery code.</h2><p class="intro">There is no email reset service. Keep this code in your password manager to reset your password later. It is shown only now.</p><div class="recovery">${result.recoveryCode}</div>${btn("I have saved it · continue", "close")}`,
        );
    }
    if (f.id === "stock-form")
      await mutate("stock", { ...d, id: id || undefined });
    if (f.id === "price-form") await mutate("price", { ...d, id });
    if (f.id === "purchase-form")
      await mutate("purchase", { ...d, id, planId: chosenPlan().id });
    if (f.id === "prepare-form") {
      if (
        await mutate("cook", {
          id,
          freeze: d.freeze === "on",
          cookedWeight: d.cookedWeight,
          plannedStorage: d.plannedStorage === "on",
        })
      )
        toast("Prepared. Ingredients deducted and portions saved.");
    }
    if (f.id === "waste-form")
      await mutate("batch", { id, operation: "waste", portions: d.portions });
    if (f.id === "feedback-form")
      await mutate("feedback", { ...d, recipeId: id });
    if (f.id === "log-form") await mutate("log", d);
    if (f.id === "food-form") await mutate("food", d);
    if (f.id === "nutrition-form")
      await mutate("nutrition", {
        id,
        ...Object.fromEntries(
          Object.entries(d).map(([k, v]) => [k.replace("nut-", ""), v]),
        ),
      });
    if (f.id === "delete-account-form") {
      await api("deleteAccount", d);
      state = null;
      renderAuth();
    }
    if (f.id === "search-form") await searchRecipes();
  } catch (error) {
    showError(error);
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener("change", (e) => {
  features.input(e.target);
  features.capture(e.target).catch(showError);
  if (e.target.id === "intake-date") {
    intakeDate = e.target.value || localDay();
    render();
  }
  if (e.target.id === "shopping-trip") {
    shoppingTripDate = e.target.value;
    render();
  }
  if (e.target.id === "plan-select") {
    shoppingTripDate = "";
    planId = e.target.value;
    render();
  }
  if (e.target.name === "type" && e.target.closest("#log-form"))
    measureFields(e.target.value);
  if (e.target.closest("#onboarding-form")) updateEstimate();
});
document.addEventListener("input", (e) => {
  features.input(e.target);
  if (e.target.closest("#onboarding-form")) updateEstimate();
});

async function boot() {
  try {
    state = (await api("state")).state;
    render();
  } catch (e) {
    if (e.message === "Sign in to continue." || e.message.includes("session")) {
      renderAuth();
    } else {
      renderAuth();
      $("#app .error").textContent = e.message;
    }
  }
}
function foodDialog() {
  modal(
    `<p class="eyebrow">LOG WHAT YOU ATE</p><h2>Food, snacks or drinks.</h2><p class="intro">Use a package or restaurant nutrition listing when available. For a one-off meal, choose per portion and enter its calories. Leave unknown nutrients blank.</p><form id="food-form">${field("Food or drink", "name", "text", "", 'required maxlength="100"')}${select(
      "Values below are",
      "basis",
      [
        ["portion", "Per portion"],
        ["100g", "Per 100 g"],
      ],
      "portion",
    )}${field("Amount eaten (portions, or grams for per 100 g)", "quantity", "number", 1, 'required min="0.1" max="10000" step="0.1"')}${field("Calories (kcal)", "kcal", "number", "", 'required min="0" max="10000" step="0.1"')}<details><summary>Protein, carbs and other nutrients (optional)</summary><div class="fields section">${["protein", "carbs", "fat", "fibre", "salt"].map((k) => field(k + " (g)", k, "number", "", 'min="0" max="1000" step="0.1"')).join("")}</div></details>${field("Source", "source", "text", "My estimate", 'maxlength="100"')}${field("Date eaten", "date", "date", screen === "progress" ? intakeDate : localDay(), "required")}<button class="btn">Save food entry</button></form>`,
  );
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
boot();
