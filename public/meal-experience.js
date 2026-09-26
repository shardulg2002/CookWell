import { dayKey, dailyIntake } from "./metrics.js";
import { actionItems } from "./action-center.js";
import { recipeMedia, hasRecipeImage } from "./recipe-media.js";

const slots = ["breakfast", "lunch", "snack", "dinner"];
const slotLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};
const nutrientLabels = {
  kcal: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fibre: "Fibre",
  salt: "Salt",
};
const addDays = (date, amount) =>
  new Date(Date.parse(date + "T12:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);
const withinWeek = (plan, date) =>
  plan && date >= plan.start && date <= addDays(plan.start, 6);
const fmt = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)
    : "—";
const weekday = (date, long = false) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: long ? "long" : "short",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
const recipeFor = (state, meal) =>
  state.catalog.find((recipe) => recipe.id === meal?.recipeId);
const externalCount = (day) =>
  Array.isArray(day?.externalSlots)
    ? day.externalSlots.length
    : Number(day?.externalSlots) || 0;
const batchFor = (state, meal) =>
  state.batches.find(
    (batch) =>
      batch.id === meal.batchId ||
      meal.allocations?.some((allocation) => allocation.batchId === batch.id),
  );

function mealState(state, plan, meal, date) {
  if (meal.status === "eaten") return { label: "Eaten", kind: "eaten" };
  if (meal.status === "out") return { label: "Eating out", kind: "out" };
  if (meal.status === "skipped") return { label: "Skipped", kind: "skipped" };
  const recipe = recipeFor(state, meal),
    batch = batchFor(state, meal);
  if (batch) {
    if (
      (batch.expires && batch.expires < date) ||
      (date === dayKey() &&
        batch.safeUntil &&
        Date.parse(batch.safeUntil) < Date.now())
    )
      return { label: "Check storage", kind: "check", batch };
    if (batch.location === "freezer")
      return { label: "Defrost first", kind: "frozen", batch };
    if (recipe?.freshAssembly)
      return { label: "Drink freshly mixed", kind: "drink", batch };
    if (["cold", "mash"].includes(recipe?.method))
      return { label: "Ready to eat", kind: "ready", batch };
    return { label: "Reheat", kind: "reheat", batch };
  }
  if (recipe?.freshAssembly || ["cold", "mash"].includes(recipe?.method))
    return { label: "Assemble", kind: "assemble" };
  if (meal.parentId) {
    const root = plan.meals.find((item) => item.id === meal.parentId);
    return {
      label: "From your batch",
      kind: "leftover",
      cookDate: root?.cookDate || root?.date,
    };
  }
  return { label: "Cook", kind: "cook" };
}

function activityFor(state, plan, date) {
  const trips = (plan.shoppingTrips || []).filter(
    (trip) => trip.date === date && trip.rows?.some((row) => row.packs > 0),
  );
  const sessions = (plan.sessions || []).filter(
    (session) => session.date === date,
  );
  const meals = plan.meals.filter(
    (meal) => meal.date === date && meal.status === "planned",
  );
  const states = meals.map((meal) => mealState(state, plan, meal, date));
  return {
    trips,
    sessions,
    reheat: states.some((item) =>
      ["reheat", "frozen", "leftover"].includes(item.kind),
    ),
    assemble: states.some((item) => item.kind === "assemble"),
  };
}

export function createMealExperience({
  getState,
  chosenPlan,
  esc,
  btn,
  cash,
  dateLabel,
  render,
  modal,
  nutritionCards,
  sessionCards,
}) {
  const selectedDates = new Map();
  const context = (plan) => `data-plan-id="${esc(plan.id)}"`;
  const mealButton = (label, meal, plan, style = "outline") =>
    btn(label, "meal", `data-id="${esc(meal.id)}" ${context(plan)}`, style);

  function foodArt(meal, slot) {
    const recipe = recipeFor(getState(), meal);
    if (hasRecipeImage(recipe) && !["out", "skipped"].includes(meal?.status))
      return `<div class="mx-photo">${recipeMedia(recipe)}</div>`;
    return `<span class="mx-food-art ${slot}" data-recipe-art="${esc(meal?.recipeId || "")}" aria-hidden="true"><svg viewBox="0 0 72 72" focusable="false"><circle cx="36" cy="36" r="28" fill="currentColor" opacity=".12"/><circle cx="36" cy="36" r="23" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".45"/><path d="M21 35c0-10 12-15 17-7 4 8-7 20-14 14-2-2-3-4-3-7Z" fill="currentColor" opacity=".65"/><circle cx="47" cy="29" r="7" fill="currentColor" opacity=".3"/><path d="m40 44 11-8 2 10-10 7Z" fill="currentColor" opacity=".45"/></svg></span>`;
  }

  function meals(plan, date) {
    const state = getState(),
      day = plan?.nutritionReport?.days?.find((item) => item.date === date);
    return `<div class="mx-meals">${slots
      .map((slot) => {
        const meal = plan?.meals.find(
          (item) => item.date === date && item.slot === slot,
        );
        if (!meal)
          return `<article class="mx-meal mx-meal-empty">${foodArt(null, slot)}<div class="mx-meal-body"><p class="mx-slot">${slotLabels[slot]}</p><h3>Not planned yet</h3><p>Choose a week covering this day.</p></div></article>`;
        const recipe = recipeFor(state, meal),
          status = mealState(state, plan, meal, date);
        const nutrition =
          day?.meals?.find((item) => item.id === meal.id)?.nutrition ||
          (meal.status === "eaten" ? meal.actualNutrition : null);
        const title =
          meal.status === "out"
            ? "Eating out"
            : meal.status === "skipped"
              ? "Meal skipped"
              : recipe?.title || "Your meal";
        return `<article class="mx-meal ${status.kind}">${foodArt(meal, slot)}<div class="mx-meal-body"><div class="mx-meal-topline"><p class="mx-slot">${slotLabels[slot]}</p><span class="mx-status ${status.kind}">${status.label}</span></div><h3><button class="mx-title-button" data-action="meal" data-id="${esc(meal.id)}" ${context(plan)}>${esc(title)}</button></h3><p class="mx-meal-meta">${["out", "skipped"].includes(meal.status) ? "Not included in planned nutrition" : status.kind === "leftover" ? `Batch preparation: ${status.cookDate ? esc(dateLabel(status.cookDate)) : "check original meal"}` : status.batch ? "Your prepared portion" : `${recipe?.active || 0} min active · ${esc(recipe?.cuisine || "Your recipe")}`}</p>${nutrition ? `<p class="mx-meal-nutrition">${Number.isFinite(nutrition.kcal) ? Math.round(nutrition.kcal) : "—"} kcal <span>· ${fmt(nutrition.protein)} g protein · ${fmt(nutrition.carbs)} g carbs</span><small>${meal.status === "eaten" ? "Recorded portion" : "Planned portion"}</small></p>` : ""}<div class="mx-meal-actions">${mealButton(["out", "skipped"].includes(meal.status) ? "View / restore" : meal.status === "eaten" ? "View details" : ["reheat", "frozen", "ready", "drink"].includes(status.kind) ? "Open portion →" : "Open meal →", meal, plan, "")}${meal.status === "planned" ? btn("Change", "swap", `data-id="${esc(meal.id)}" ${context(plan)}`, "outline") : ""}</div></div></article>`;
      })
      .join("")}</div>`;
  }

  function nextAction(plan, date, isToday = false) {
    if (!plan) {
      const hasPreviousWeeks = getState().plans.length > 0;
      return {
        eyebrow: "LET'S PLAN",
        title: hasPreviousWeeks
          ? "No plan for today yet."
          : "Your first week starts here.",
        detail: hasPreviousWeeks
          ? "Create a new editable draft covering today. Your saved weeks will stay available in the weekly plan."
          : "Create a week to see your meals, shopping and cooking days.",
        label: hasPreviousWeeks
          ? "Create a draft from today"
          : "Open weekly plan",
        action: hasPreviousWeeks ? "current-week-draft" : "nav",
        data: hasPreviousWeeks ? "" : 'data-screen="plan"',
        kind: "plan",
      };
    }
    const state = getState();
    const due = (item) => item.date === date || (isToday && item.date < date);
    const trip = (plan.shoppingTrips || []).find(
      (item) => due(item) && item.rows?.some((row) => row.packs > 0),
    );
    if (trip)
      return {
        eyebrow:
          trip.date < date
            ? "SHOPPING TO CATCH UP"
            : isToday
              ? "SHOP TODAY"
              : "SHOPPING DAY",
        title: "A shop that covers your next meals.",
        detail: `${trip.rows.filter((row) => row.packs > 0).length} ingredients to buy · ${cash(trip.total)} remaining forecast. Confirm what you buy to update your kitchen.`,
        label: "Open shopping list →",
        action: "shop-day",
        data: `data-date="${esc(trip.date)}" ${context(plan)}`,
        kind: "shop",
      };
    const session = (plan.sessions || []).find(due);
    if (session) {
      const portions = session.dishes.reduce(
        (sum, dish) => sum + dish.portions,
        0,
      );
      return {
        eyebrow:
          session.date < date
            ? "BATCH PREPARATION TO REVIEW"
            : isToday
              ? "COOK TODAY"
              : "COOKING DAY",
        title: `${session.dishes.length} ${session.dishes.length === 1 ? "dish" : "dishes"}. ${portions} portions. One session.`,
        detail: `${session.dishes.map((dish) => dish.title).join(" · ")}. About ${session.activeMinutes} active minutes before multitasking or batch adjustments.`,
        label: "Start guided cooking →",
        action: "cook-session",
        data: `data-id="${esc(session.id)}" ${context(plan)}`,
        kind: "cook",
      };
    }
    const meal = slots
      .map((slot) =>
        plan.meals.find(
          (item) =>
            item.date === date &&
            item.slot === slot &&
            item.status === "planned",
        ),
      )
      .find(Boolean);
    if (meal) {
      const recipe = recipeFor(state, meal),
        status = mealState(state, plan, meal, date);
      if (status.kind === "check")
        return {
          eyebrow: "CHECK YOUR PREPARED FOOD",
          title: "Review this portion before eating.",
          detail:
            "Its recorded storage time has passed. Check Kitchen and choose another meal if needed.",
          label: "Check Kitchen →",
          action: "nav",
          data: `data-screen="kitchen" ${context(plan)}`,
          kind: "check",
        };
      if (status.kind === "drink")
        return {
          eyebrow: "DRINK FRESHLY MIXED",
          title: recipe?.title || "Your freshly mixed shake",
          detail:
            "Your measured shake is ready. Drink it fresh and record how much you drank.",
          label: "Open my shake →",
          action: "meal",
          data: `data-id="${esc(meal.id)}" ${context(plan)}`,
          kind: "drink",
        };
      return {
        eyebrow:
          status.kind === "frozen"
            ? "DEFROST BEFORE REHEATING"
            : status.kind === "reheat"
              ? "REHEAT & ENJOY"
              : status.kind === "ready"
                ? "YOUR PORTION IS READY"
                : status.kind === "assemble"
                  ? "A QUICK FRESH MEAL"
                  : "YOUR NEXT MEAL",
        title: recipe?.title || "Open your planned meal",
        detail:
          status.kind === "frozen"
            ? "Defrost safely in the fridge before reheating. Open your portion for its storage details."
            : status.kind === "reheat"
              ? "This portion is already prepared. Reheat it and record the amount you eat."
              : status.kind === "ready"
                ? "Open your prepared portion, check storage and record the amount you eat."
                : status.kind === "assemble"
                  ? `Around ${recipe?.active || 0} minutes to put together. Use the measured quantities in your recipe.`
                  : "Open the meal to see its cooking batch and measured ingredients.",
        label:
          status.kind === "assemble" ? "Make this meal →" : "Open my portion →",
        action: "meal",
        data: `data-id="${esc(meal.id)}" ${context(plan)}`,
        kind: status.kind,
      };
    }
    return {
      eyebrow: isToday ? "TODAY IS SORTED" : "THIS DAY IS PLANNED",
      title: "Make room for the rest of your day.",
      detail:
        "Your meals are recorded, skipped or set to eating out. Add any food or drinks you have outside the plan.",
      label: "+ Record food or drink",
      action: "food-log",
      data: "",
      kind: "done",
    };
  }

  function actionCard(action) {
    return `<section class="mx-next ${action.kind}" aria-label="Next useful action"><div><p class="eyebrow">${esc(action.eyebrow)}</p><h2>${esc(action.title)}</h2><p class="mx-next-detail">${esc(action.detail)}</p>${btn(action.label, action.action, action.data, "mx-primary")}</div><span class="mx-next-mark" aria-hidden="true">${action.kind === "shop" ? "↗" : action.kind === "cook" ? "✳" : action.kind === "done" ? "✓" : "→"}</span></section>`;
  }

  function budgetFor(plan) {
    const state = getState(),
      report = plan?.nutritionReport;
    if (report?.budget) return report.budget;
    const total =
      (state.purchases || [])
        .filter((item) => item.planId === plan?.id)
        .reduce((sum, item) => sum + item.cost, 0) +
      (plan?.shopping || []).reduce((sum, item) => sum + item.cost, 0);
    return {
      total,
      limit: state.profile.budget,
      within: total <= state.profile.budget,
    };
  }

  function weekSummary(plan) {
    if (!plan) return "";
    const budget = budgetFor(plan),
      days = plan.nutritionReport?.days || [],
      met = days.filter(
        (day) => day.assessment?.met && !externalCount(day),
      ).length;
    const spent = (getState().purchases || [])
      .filter((item) => item.planId === plan.id)
      .reduce((sum, item) => sum + item.cost, 0);
    return `<section class="mx-week-summary" aria-label="Week budget and nutrition"><div class="mx-summary-money"><span>Weekly groceries</span><strong>${cash(budget.total)} <small>/ ${cash(budget.limit)}</small></strong><small>${cash(spent)} bought · full packs counted</small></div><div><span>Nutrition coverage</span><strong>${days.length ? `${met} / ${days.length} days` : "Not assessed"}</strong><small>${days.length && met !== days.length ? "Some daily targets need review" : days.length ? "Within your planning ranges" : "Set up targets to check this week"}</small></div><div><span>Batch cooking</span><strong>${plan.sessions?.length || 0} sessions</strong><small>Still to prepare this week</small></div></section>${!budget.within || (days.length && met !== days.length) ? `<div class="mx-attention" role="note"><span>${!budget.within ? `${cash(budget.total - budget.limit)} above your grocery budget. ` : ""}${days.length && met !== days.length ? `${days.length - met} day${days.length - met === 1 ? "" : "s"} outside targets or incomplete.` : ""}</span>${btn("Review balance →", "rebalance-plan", `data-id="${esc(plan.id)}" ${context(plan)}`, "outline")}</div>` : ""}`;
  }

  function recordedToday(date) {
    const state = getState(),
      diary = dailyIntake(state, date),
      values = state.nutritionTargets?.values || {},
      entries = diary.entries;
    const actual = (key) =>
      entries.some((entry) => Number.isFinite(entry.nutrition?.[key]))
        ? fmt(diary.total[key])
        : "—";
    return `<section class="mx-recorded" aria-label="Actual food recorded today"><div class="mx-section-heading"><div><p class="eyebrow">WHAT YOU'VE ACTUALLY EATEN</p><h2>${actual("kcal")} <small>/ ${fmt(values.kcal ?? state.profile.calorieTarget)} kcal</small></h2></div>${btn("+ Log food", "food-log", "", "outline")}</div><div class="mx-recorded-macros">${["protein", "carbs", "fat", "fibre", "salt"].map((key) => `<div><span>${nutrientLabels[key]}</span><strong>${actual(key)} <small>/ ${key === "salt" ? "max " : ""}${fmt(values[key])} g</small></strong></div>`).join("")}</div><p class="hint">${!entries.length ? "Nothing logged yet. Planned meals are not counted as eaten." : diary.incomplete ? "Some nutrient amounts are missing; these recorded totals are partial." : "Recorded so far from confirmed portions and your food diary."} ${btn("Open food diary →", "nav", 'data-screen="progress"', "mx-text")}</p></section>`;
  }

  function dayNutrition(plan, date) {
    const day = plan?.nutritionReport?.days?.find((item) => item.date === date);
    if (!day) return "";
    const issues = (day.assessment?.issues || []).filter((item) =>
      ["low", "high"].includes(item.status),
    );
    return `<div class="mx-day-nutrition"><p><strong>${Math.round(day.totals.kcal)} kcal</strong> accounted for <span>· ${fmt(day.totals.protein)} g protein · ${fmt(day.totals.carbs)} g carbs · ${fmt(day.totals.fibre)} g fibre</span></p><small>${
      externalCount(day)
        ? "Eating-out or skipped meals leave a gap in this day."
        : day.assessment?.met
          ? "Within your daily planning targets."
          : issues.length
            ? issues
                .slice(0, 3)
                .map(
                  (item) =>
                    `${nutrientLabels[item.key]} ${fmt(item.gap)} ${item.key === "kcal" ? "kcal" : "g"} ${item.status === "low" ? "below" : "above"} range`,
                )
                .join(" · ")
            : "Nutrition targets need review."
    } Planned portions and recorded meal portions; not a food diary total.</small></div>`;
  }

  function reminders(plan, date) {
    if (!plan) return "";
    const items = actionItems(getState(), plan, date).filter(
      (item) => !["cook", "shop"].includes(item.kind),
    );
    if (!items.length) return "";
    const urgent = items.filter((item) => item.priority === 0),
      other = items.filter((item) => item.priority !== 0);
    const row = (item) =>
      `<div class="mx-reminder"><div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div>${btn(item.label, item.action, `${item.target ? `data-id="${esc(item.target)}"` : ""} ${item.screen ? `data-screen="${esc(item.screen)}"` : ""} ${context(plan)}`, "outline")}</div>`;
    return `${urgent.length ? `<div class="mx-attention mx-stock-alert"><div><strong>Check ${urgent.length} food storage item${urgent.length === 1 ? "" : "s"}</strong><p>Some recorded use-by times have passed.</p></div>${btn("Open Kitchen", "nav", 'data-screen="kitchen"', "outline")}</div>` : ""}<details class="mx-disclosure"><summary>Kitchen reminders & check-ins <span>${items.length}</span></summary>${[...urgent, ...other].map(row).join("")}</details>`;
  }

  function today() {
    const state = getState(),
      date = dayKey(),
      selected = chosenPlan();
    const plan = withinWeek(selected, date)
      ? selected
      : state.plans.find((item) => withinWeek(item, date));
    const planData = `data-screen="plan"${plan ? " " + context(plan) : ""}`;
    return `<div class="mx-experience mx-today">${actionCard(nextAction(plan, date, true))}<section class="mx-menu-section"><div class="mx-section-heading"><div><p class="eyebrow">${esc(weekday(date, true).toUpperCase())} · ${esc(dateLabel(date))}</p><h2>Your meals today</h2></div>${btn("Full week →", "nav", planData, "mx-text")}</div>${meals(plan, date)}</section>${recordedToday(date)}${plan ? `<details class="mx-disclosure"><summary>This week's budget & targets</summary>${weekSummary(plan)}${dayNutrition(plan, date)}${btn("Open weekly plan →", "nav", planData, "outline")}</details>` : ""}${plan && !budgetFor(plan).within ? `<p class="mx-inline-alert">Your week is ${cash(budgetFor(plan).total - budgetFor(plan).limit)} over budget. ${btn("Review plan", "nav", planData, "mx-text")}</p>` : ""}${plan?.nutritionReport?.days?.some((day) => !day.assessment?.met) ? '<p class="mx-inline-alert">Your weekly plan has nutrition gaps. Check the budget & targets summary above.</p>' : ""}${reminders(plan, date)}<div class="mx-checkins">${btn("+ Glucose", "log", 'data-type="glucose"', "mx-text")}${btn("+ Weight", "log", 'data-type="weight"', "mx-text")}${btn("+ Steps", "log", 'data-type="steps"', "mx-text")}</div></div>`;
  }

  function plan() {
    const state = getState(),
      selected = chosenPlan();
    if (!selected)
      return `<div class="mx-experience">${actionCard(nextAction(null, dayKey()))}</div>`;
    let date = selectedDates.get(selected.id);
    if (!withinWeek(selected, date))
      date = withinWeek(selected, dayKey()) ? dayKey() : selected.start;
    selectedDates.set(selected.id, date);
    const activity = activityFor(state, selected, date);
    return `<div class="mx-experience mx-plan"><div class="mx-week-toolbar"><label>My week<select id="plan-select" aria-label="Select week">${state.plans.map((item) => `<option value="${esc(item.id)}" ${item.id === selected.id ? "selected" : ""}>${esc(dateLabel(item.start))} – ${esc(dateLabel(addDays(item.start, 6)))} · ${esc(item.status)}</option>`).join("")}</select></label>${btn("Next week draft →", "next-week", "", "outline")}</div>${selected.status === "draft" ? `<div class="mx-draft"><div><strong>Your draft is ready.</strong><p>Check your stock and use-by dates, then confirm the week.</p></div>${btn("Stock checked · confirm week", "activate", `data-id="${esc(selected.id)}"`)}</div>` : ""}${weekSummary(selected)}<div class="mx-days" role="group" aria-label="Choose a day of this week">${Array.from(
      { length: 7 },
      (_, index) => {
        const value = addDays(selected.start, index),
          schedule = activityFor(state, selected, value),
          badges = [
            schedule.trips.length ? "Shop" : "",
            schedule.sessions.length ? "Cook" : "",
            schedule.reheat ? "Reheat" : "",
            !schedule.sessions.length && !schedule.reheat && schedule.assemble
              ? "Assemble"
              : "",
          ].filter(Boolean);
        return `<button class="mx-day${value === date ? " selected" : ""}" data-action="mx-select-day" data-id="${value}" data-plan-id="${esc(selected.id)}" aria-pressed="${value === date}" aria-label="${esc(weekday(value, true))}, ${esc(dateLabel(value))}${badges.length ? ", " + badges.join(", ") : ""}"><span>${esc(weekday(value))}</span><strong>${Number(value.slice(-2))}</strong><small>${badges.join(" · ") || "Meals"}</small></button>`;
      },
    ).join(
      "",
    )}</div><section class="mx-menu-section" aria-label="Meals for selected day"><div class="mx-section-heading"><div><p class="eyebrow">${esc(dateLabel(date))}</p><h2>${esc(weekday(date, true))}'s menu</h2></div><span class="mx-day-mode">${activity.sessions.length ? "Batch cooking day" : activity.reheat ? "Reheat / assemble day" : "Fresh meals"}</span></div>${actionCard(nextAction(selected, date, date === dayKey()))}${meals(selected, date)}${dayNutrition(selected, date)}</section><div class="mx-plan-actions">${btn("Shopping list →", "nav", `data-screen="kitchen" ${context(selected)}`, "outline")}${btn("Cooking & shopping rhythm", "rhythm-settings", "", "outline")}</div><details class="mx-disclosure"><summary>Detailed nutrition & budget report</summary>${nutritionCards("plan")}</details><details class="mx-disclosure"><summary>All cooking sessions <span>${selected.sessions?.length || 0}</span></summary>${sessionCards("plan")}</details><details class="mx-disclosure"><summary>Review this week</summary><p class="hint">Tell CookWell which meals and routines worked for your next plan.</p>${btn("Open weekly review", "weekly-review", "", "outline")}</details></div>`;
  }

  function click(action, id, button) {
    if (action !== "mx-select-day") return false;
    const selected = chosenPlan();
    if (
      !selected ||
      !withinWeek(selected, id) ||
      (button?.dataset?.planId && button.dataset.planId !== selected.id)
    )
      return true;
    selectedDates.set(selected.id, id);
    render();
    if (typeof document !== "undefined")
      document
        .querySelector(".mx-day.selected")
        ?.focus({ preventScroll: true });
    return true;
  }
  return { today, plan, click };
}
