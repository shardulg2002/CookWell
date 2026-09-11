// Structured dependencies, separate from the UI so multitasking can be regression tested.
export function createFlow(dishes, profile) {
  const stages = [];
  for (const dish of dishes) {
    let prep = null,
      main = null;
    const grains = [];
    let lastHeat = null;
    dish.recipe.steps.forEach((step, index) => {
      const id = dish.mealId + ":" + index,
        grain = ["Cook the rice", "Cook the pasta"].includes(step.title),
        store = step.title === "Portion and store",
        cold = ["cold", "mash"].includes(dish.recipe.method);
      const resource =
        index === 0 || store || cold
          ? null
          : dish.recipe.method === "oven"
            ? "oven"
            : "hob";
      const key = resource ? dish.mealId + (grain ? ":grain" : ":main") : null;
      let deps = index === 0 ? [] : grain ? [prep] : [main || prep];
      if (store || step.title === "Add the eggs")
        deps = [...new Set([...deps, ...grains])];
      const parallel =
        grain ||
        ["Heat the oven and start vegetables", "Add protein"].includes(
          step.title,
        ) ||
        (step.title === "Add the measured ingredients" &&
          /simmer/i.test(step.text));
      const sentences = step.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      const waitIndex = parallel
        ? sentences.findIndex((s) =>
            /\b(cook on low|cook for|roast for|simmer gently)\b/i.test(s),
          )
        : -1;
      const instructions =
        waitIndex >= 0 ? sentences.slice(0, waitIndex + 1) : sentences;
      const monitorNotes =
        waitIndex >= 0 ? sentences.slice(waitIndex + 1).join(" ") : "";
      stages.push({
        id,
        mealId: dish.mealId,
        recipe: dish.recipe,
        step,
        index,
        deps: deps.filter(Boolean),
        resource,
        key,
        parallel,
        seconds: step.seconds || 0,
        instructions,
        monitorNotes,
        finishNote:
          step.title === "Cook the pasta"
            ? "When the pasta is ready, drain it carefully before confirming this stage."
            : "",
        cursor: 0,
        status: "pending",
      });
      if (index === 0) prep = id;
      else if (grain) grains.push(id);
      else main = id;
      if (resource && !grain) lastHeat = id;
    });
    for (const st of stages.filter(
      (s) => s.mealId === dish.mealId && s.resource,
    ))
      st.release = st.key.endsWith(":grain") ? st.id : lastHeat;
  }
  return {
    dishes,
    stages,
    capacities: {
      hob: profile.equipment.includes("hob") ? profile.hobCount || 1 : 0,
      oven: profile.equipment.includes("oven") ? 1 : 0,
    },
  };
}
export function heldResources(flow) {
  const held = new Map();
  for (const s of flow.stages) {
    if (
      s.resource &&
      s.status !== "pending" &&
      flow.stages.find((x) => x.id === s.release)?.status !== "done"
    )
      held.set(s.key, s.resource);
  }
  return held;
}
export function readyStages(flow) {
  if (
    flow.stages.some(
      (s) => s.status === "working" || (s.status === "waiting" && !s.parallel),
    )
  )
    return [];
  const held = heldResources(flow);
  return flow.stages
    .filter(
      (s) =>
        s.status === "pending" &&
        s.deps.every(
          (id) => flow.stages.find((x) => x.id === id)?.status === "done",
        ) &&
        (!s.resource ||
          held.has(s.key) ||
          [...held.values()].filter((r) => r === s.resource).length <
            flow.capacities[s.resource]),
    )
    .sort(
      (a, b) =>
        (b.parallel ? 1 : 0) - (a.parallel ? 1 : 0) ||
        b.seconds - a.seconds ||
        b.recipe.total - a.recipe.total,
    );
}
export function beginStage(flow, id) {
  const s = readyStages(flow).find((s) => s.id === id);
  if (!s)
    throw new Error(
      "Finish the current step or free the required hob / oven first.",
    );
  s.status = "working";
  return s;
}
export function advanceStage(flow, id) {
  const s = flow.stages.find((s) => s.id === id);
  if (s?.status !== "working") throw new Error("Open the current step first.");
  if (s.cursor < s.instructions.length - 1) {
    s.cursor++;
    return;
  }
  if (s.parallel && s.seconds)
    throw new Error("Start the cooking timer or confirm the food check first.");
  s.status = "done";
}
export function startStageTimer(flow, id, seconds, now = Date.now()) {
  const s = flow.stages.find((s) => s.id === id);
  if (
    s?.status !== "working" ||
    s.cursor !== s.instructions.length - 1 ||
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    seconds > 14400
  )
    throw new Error("Check the step and timer duration.");
  s.deadline = now + seconds * 1000;
  s.duration = seconds;
  s.status = "waiting";
  s.halfNotified = false;
}
export function checkStage(flow, id) {
  const s = flow.stages.find((s) => s.id === id);
  if (!s || !["waiting", "check"].includes(s.status))
    throw new Error("This timer is not running.");
  s.status = "done";
  delete s.deadline;
}
export function flowSignature(dishes) {
  return dishes
    .map((d) => d.mealId + ":" + d.recipe.id + ":" + d.recipe.multiplier)
    .join("|");
}
