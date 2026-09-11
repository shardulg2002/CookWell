import {
  createFlow,
  readyStages,
  beginStage,
  advanceStage,
  startStageTimer,
  checkStage,
  heldResources,
} from "./cook-flow.js";
import { stepAmounts, instructionList, techniqueVisual } from "./cooking.js";
export function createSessionCooking(ctx) {
  const { getState, chosenPlan, api, modal, esc, btn, toast, prepare } = ctx;
  let flow = null,
    key = null,
    interval = null;
  const dishDone = (id) =>
    flow.stages
      .filter((s) => s.mealId === id)
      .every((s) => s.status === "done");
  const saved = (id) =>
    getState()
      .plans.flatMap((p) => p.meals)
      .find((m) => m.id === id)?.batchId;
  function tick() {
    if (!flow) return;
    for (const s of flow.stages.filter((s) => s.status === "waiting")) {
      const left = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
      if (!s.halfNotified && left <= s.duration / 2 && left > 0) {
        s.halfNotified = true;
        toast(
          "Check / stir: " +
            s.recipe.title +
            ". Keep an eye on heat and water.",
        );
      }
      if (!left) {
        s.status = "check";
        toast(
          "Timer finished: " +
            s.recipe.title +
            ". Check the food before continuing.",
        );
        if (document.querySelector("#session-cooking")) render();
      }
    }
    document.querySelectorAll("[data-cook-clock]").forEach((el) => {
      const s = flow.stages.find((s) => s.id === el.dataset.cookClock);
      if (s) {
        const left = Math.max(
          0,
          Math.ceil(((s.deadline || Date.now()) - Date.now()) / 1000),
        );
        el.textContent =
          s.status === "check"
            ? "Check food now"
            : Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
      }
    });
  }
  async function open(session) {
    if (flow && key === session.id) {
      const changed = session.dishes.some((d) => {
        const old = flow.dishes.find((x) => x.mealId === d.mealId);
        return (
          !old ||
          old.recipe.id !== d.recipeId ||
          old.recipe.multiplier !== d.multiplier
        );
      });
      if (changed)
        throw new Error(
          "The plan quantities changed. Resume and finish any active heating, then end this walkthrough and reopen the session.",
        );
      render();
      return;
    }
    if (
      flow?.stages.some((s) =>
        ["working", "waiting", "check"].includes(s.status),
      )
    )
      throw new Error(
        "A cooking session is in progress. Resume it and finish or check its active tasks before starting another.",
      );
    const dishes = await Promise.all(
      session.dishes.map(async (d) => ({
        ...d,
        recipe: await api(
          "recipe&id=" +
            encodeURIComponent(d.recipeId) +
            "&multiplier=" +
            d.multiplier,
        ),
      })),
    );
    flow = createFlow(dishes, getState().profile);
    key = session.id;
    if (interval) clearInterval(interval);
    interval = setInterval(tick, 1000);
    render();
  }
  async function single(recipe, meal) {
    const planned = meal
      ? chosenPlan()
          ?.sessions?.flatMap((s) => s.dishes)
          .find((d) => d.mealId === meal.id)
      : null;
    return open({
      id: "single:" + recipe.id + ":" + (meal?.id || "library"),
      dishes: [
        {
          mealId: meal?.id || "library",
          recipeId: recipe.id,
          multiplier: recipe.multiplier,
          portions: planned?.portions || 1,
        },
      ],
    });
  }
  function render() {
    if (!flow) return;
    for (const stage of flow.stages)
      if (saved(stage.mealId)) {
        stage.status = "done";
        delete stage.deadline;
      }
    const working = flow.stages.find((s) => s.status === "working"),
      waiting = flow.stages.filter((s) =>
        ["waiting", "check"].includes(s.status),
      ),
      ready = readyStages(flow),
      held = heldResources(flow);
    const active = working
      ? `<article class="focus-step"><p class="eyebrow">${esc(working.recipe.title)} · ${working.index + 1}/${working.recipe.steps.length}</p><h2>${esc(working.step.title)}</h2><div class="step-progress">${working.instructions.map((_, i) => `<i class="${i <= working.cursor ? "done" : ""}"></i>`).join("")}</div><p class="hint">Action ${working.cursor + 1} of ${working.instructions.length}</p><div class="focus-instruction">${instructionList(working.instructions[working.cursor])}</div><details ${working.index === 0 ? "open" : ""}><summary>Exact ingredients for this stage</summary>${stepAmounts(working.recipe, working.step)}</details>${working.cursor === 0 ? techniqueVisual(working.recipe, working.step) : ""}<div class="row section">${working.cursor ? btn("← Read previous action", "cook-back", `data-id="${working.id}"`, "outline") : ""}${working.cursor === working.instructions.length - 1 && working.parallel && working.seconds ? `<form id="cook-timer-form" data-id="${working.id}"><label>Minutes (use the actual pack / recipe timing)<input name="minutes" type="number" min="0.1" max="240" step="0.1" value="${working.seconds / 60}" required></label><button class="btn">Start timer & continue prep →</button></form>` : btn(working.cursor === working.instructions.length - 1 ? "Step done →" : "Next action →", "cook-next", `data-id="${working.id}"`)}</div>${working.resource && !working.parallel ? '<p class="notice">Hands-on step: stay at the pan. We will not suggest another task until you finish this step.</p>' : ""}</article>`
      : "";
    const taskCards = ready.map(
      (s) =>
        `<div class="list-row"><div><strong>${esc(s.step.title)}</strong><small class="source">${esc(s.recipe.title)}${s.resource ? " · " + s.resource : ""}</small></div>${btn("Do this next", "cook-begin", `data-id="${s.id}"`, "soft")}</div>`,
    );
    const tasks =
      (taskCards[0] || "") +
      (taskCards.length > 1
        ? `<details><summary>Other available tasks (${taskCards.length - 1})</summary>${taskCards.slice(1).join("")}</details>`
        : "");
    modal(
      `<section id="session-cooking"><p class="eyebrow">COOKING SESSION · ${flow.dishes.length} DISH${flow.dishes.length === 1 ? "" : "ES"}</p><details class="session-menu"><summary>See dishes and portion counts</summary><div class="session-chips">${flow.dishes.map((d) => `<span class="badge">${esc(d.recipe.title)}${d.portions ? " · " + d.portions + " portions" : ""}</span>`).join("")}</div></details><p class="hint">${[...held.values()].filter((r) => r === "hob").length}/${flow.capacities.hob} hob rings in use · ${[...held.values()].filter((r) => r === "oven").length}/${flow.capacities.oven} oven in use. Timers keep running when moving between steps. Keep this tab open; background alerts are not guaranteed.</p>${waiting.length ? `<section class="timer-rail"><h3>Cooking in the background</h3>${waiting.map((s) => `<article class="timer-tile ${s.status === "check" ? "needs-check" : ""}"><strong>${esc(s.recipe.title)}</strong><span>${esc(s.step.title)}</span><b data-cook-clock="${s.id}">${s.status === "check" ? "Check food now" : "Timer running"}</b>${btn(s.status === "check" ? "Check food →" : "Check early / adjust →", "cook-check", `data-id="${s.id}"`, "outline")}<small>${s.monitorNotes ? esc(s.monitorNotes) : "Stay nearby; stir / check periodically."}</small></article>`).join("")}</section>` : ""}${active}${!working ? `<h2 class="section">${waiting.length ? "While that cooks…" : "Your next small step."}</h2><p class="hint">Only tasks with clear dependencies and available equipment appear here.</p><div class="stack">${tasks || (waiting.length ? "<p>Check a running dish above to free the next step. A timer finishing never marks food cooked automatically.</p>" : "<p>The steps are complete. Confirm each prepared dish below to update Kitchen.</p>")}</div>` : ""}${flow.dishes
        .filter((d) => dishDone(d.mealId))
        .map(
          (d) =>
            `<div class="notice row between"><div><strong>${esc(d.recipe.title)} — steps complete</strong><p>${saved(d.mealId) ? "Saved in Kitchen." : d.mealId === "library" ? "Library walkthrough complete. Add this recipe to a meal plan to track portions." : "Confirm actual preparation and storage to save your portions."}</p></div>${!saved(d.mealId) && d.mealId !== "library" ? btn("Weigh, portion & save", "cook-save", `data-id="${d.mealId}"`) : ""}</div>`,
        )
        .join(
          "",
        )}${btn("End walkthrough", "cook-end", "", "outline")}<p class="hint">Wash hands and clean boards / utensils after handling raw meat or fish, before switching to ready-to-eat food. Never leave cooking unattended.</p></section>`,
    );
    tickClocks();
  }
  function tickClocks() {
    document.querySelectorAll("[data-cook-clock]").forEach((el) => {
      const s = flow.stages.find((s) => s.id === el.dataset.cookClock),
        left = Math.max(
          0,
          Math.ceil(((s?.deadline || Date.now()) - Date.now()) / 1000),
        );
      el.textContent =
        s?.status === "check"
          ? "Check food now"
          : Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    });
  }
  function check(id) {
    const s = flow.stages.find((s) => s.id === id);
    modal(
      `<h2>Check ${esc(s.recipe.title)}</h2><p>${esc(s.step.title)}. A timer is a reminder, not proof of doneness. Check texture, water level and the recipe's food-safety instructions. Continue cooking if not ready.</p>${s.finishNote ? `<p class="notice">${esc(s.finishNote)}</p>` : ""}<form id="cook-extend-form" data-id="${id}"><label>More time (minutes)<input name="minutes" type="number" min="1" max="120" value="3" required></label><button class="btn outline">Keep cooking</button></form><label class="check-label"><input id="food-check-confirm" type="checkbox">I checked this stage; it is ready to continue</label>${btn("Stage ready →", "cook-checked", `data-id="${id}"`)}${btn("Return to session", "cook-resume", "", "outline")}`,
    );
  }
  async function click(a, id) {
    if (a === "cook-session") {
      const session = chosenPlan().sessions.find((s) => s.id === id);
      if (!session)
        throw new Error("This session has changed. Refresh the plan.");
      await open(session);
    } else if (a === "cook-resume") {
      if (!flow) throw new Error("Open a session from your plan first.");
      render();
    } else if (a === "cook-begin") {
      beginStage(flow, id);
      render();
    } else if (a === "cook-next") {
      advanceStage(flow, id);
      render();
    } else if (a === "cook-back") {
      const s = flow.stages.find((s) => s.id === id);
      if (s?.status === "working") s.cursor = Math.max(0, s.cursor - 1);
      render();
    } else if (a === "cook-check") check(id);
    else if (a === "cook-checked") {
      if (!document.querySelector("#food-check-confirm")?.checked)
        throw new Error("Check the food and tick the confirmation first.");
      checkStage(flow, id);
      render();
    } else if (a === "cook-save") prepare(id);
    else if (a === "cook-end") {
      if (
        heldResources(flow).size ||
        flow.stages.some((s) => ["waiting", "check"].includes(s.status))
      )
        throw new Error(
          "Finish and check active cooking before ending this walkthrough.",
        );
      flow = null;
      key = null;
      clearInterval(interval);
      interval = null;
      modal(
        "<h2>Walkthrough ended.</h2><p>Saved cooked portions remain in Kitchen. Unconfirmed preparation has not changed your stock.</p>",
      );
    } else return false;
    return true;
  }
  function submit(f, d) {
    if (f.id === "cook-timer-form") {
      startStageTimer(flow, f.dataset.id, Number(d.minutes) * 60);
      render();
    } else if (f.id === "cook-extend-form") {
      const s = flow.stages.find((s) => s.id === f.dataset.id);
      s.status = "working";
      startStageTimer(flow, s.id, Number(d.minutes) * 60);
      render();
    } else return false;
    return true;
  }
  function reset() {
    if (interval) clearInterval(interval);
    interval = null;
    flow = null;
    key = null;
  }
  return {
    open,
    single,
    click,
    submit,
    reset,
    resumeButton: () =>
      flow ? btn("Resume cooking session", "cook-resume", "", "outline") : "",
  };
}
