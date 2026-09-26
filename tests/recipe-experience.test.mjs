import test from "node:test";
import assert from "node:assert/strict";
import {
  recipeExperience,
  servingNutrition,
} from "../public/recipe-experience.js";
import { expired } from "../lib/batch-actions.mjs";
import { dayKey } from "../public/metrics.js";
import { detailedSteps, recipes, recipeMap } from "../lib/catalog.mjs";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ui = {
  esc,
  btn: (label, action, attrs = "") =>
    `<button data-action="${action}" ${attrs}>${label}</button>`,
  dateLabel: (date) => date,
};
const nutrients = {
  kcal: 480,
  protein: 30,
  carbs: 50,
  fat: 16,
  fibre: 8,
  salt: 1,
};
const recipe = {
  id: "test-recipe",
  title: "A measured meal",
  cuisine: "Test",
  method: "stew",
  nutrition: nutrients,
  ingredients: [
    {
      quantity: 200,
      unit: "g",
      name: "Beans, drained",
      nutritionSource: "Pack label",
    },
  ],
  steps: [
    {
      title: "Weigh and prepare",
      text: "Weigh 200 g Beans, drained. Stir well.",
    },
  ],
};
const meal = {
  id: "meal",
  recipeId: recipe.id,
  status: "planned",
  date: "2099-01-01",
  multiplier: 1,
};
const lot = (patch = {}) => ({
  id: "lot",
  nutrition: nutrients,
  expires: "2099-01-02",
  remaining: 3,
  location: "fridge",
  gramsPerPortion: 320,
  ...patch,
});
const render = ({
  m = meal,
  r = recipe,
  batches = [],
  meals = [m],
  ...extra
} = {}) =>
  recipeExperience(
    {
      state: { batches, plans: [{ meals }], feedback: [] },
      recipe: r,
      meal: m,
      plan: { meals },
      ...extra,
    },
    ui,
  );

test("recipe details distinguish the whole scaled batch from each equal serving", () => {
  const meals = [
    meal,
    { ...meal, id: "second", parentId: meal.id },
    { ...meal, id: "third", parentId: meal.id },
  ];
  const scaled = {
    ...recipe,
    nutrition: Object.fromEntries(
      Object.entries(nutrients).map(([k, value]) => [k, value * 3]),
    ),
    ingredients: [{ ...recipe.ingredients[0], quantity: 600 }],
    steps: [
      {
        title: "Weigh and prepare",
        text: "Weigh 600 g Beans, drained. Stir well.",
      },
    ],
  };
  assert.deepEqual(
    servingNutrition({ batches: [] }, meal, scaled, 3),
    nutrients,
  );
  const html = render({ meals, r: scaled });
  assert.match(html, /1 cooking batch → 3 equal portions/);
  assert.match(html, /Start cooking · 3 portions/);
  assert.match(html, /<strong>480<\/strong><small>kcal/);
  assert.match(html, /<strong>600 g<\/strong>/);
  assert.match(html, /For the whole 3-portion batch/);
  assert.match(html, /id="ingredients-panel"/);
  assert.match(html, /id="instructions-panel"[^>]* hidden/);
});

test("prepared multi-lot food uses saved nutrients and measured weights, never recooks raw ingredients", () => {
  const m = {
    ...meal,
    batchId: "lot",
    allocations: [
      { batchId: "lot", portions: 0.5 },
      { batchId: "other", portions: 1 },
    ],
  };
  const batches = [
    lot(),
    lot({
      id: "other",
      nutrition: { ...nutrients, kcal: 300, protein: 20 },
      gramsPerPortion: 250,
    }),
  ];
  const n = servingNutrition({ batches }, m, {
    ...recipe,
    nutrition: { ...nutrients, kcal: 999 },
  });
  assert.equal(n.kcal, 540);
  assert.equal(n.protein, 35);
  const html = render({ m, batches });
  assert.match(html, /1.5 allocated portions · 410 g finished food/);
  assert.match(html, /Log amount eaten/);
  assert.match(html, /Reheat your measured portion/);
  assert.match(html, /Original recipe reference · not another cooking task/);
  assert.doesNotMatch(html, /data-action="(?:guided|prepare)"/);
});

test("partial historical nutrients remain unknown instead of zero and known zero stays zero", () => {
  const m = {
    ...meal,
    batchId: "lot",
    allocations: [
      { batchId: "lot", portions: 1 },
      { batchId: "other", portions: 0.5 },
    ],
  };
  const batches = [
    lot({ nutrition: { kcal: 100, protein: null, salt: 0 } }),
    lot({ id: "other" }),
  ];
  const n = servingNutrition({ batches }, m, recipe);
  assert.equal(n.kcal, 340);
  assert.equal(n.protein, null);
  assert.equal(n.carbs, null);
  assert.equal(n.salt, 0.5);
  assert.match(render({ m, batches }), /<strong>—<\/strong><small>protein · g/);
  const base = servingNutrition({ batches: [] }, null, {
    ...recipe,
    nutrition: { kcal: 100, protein: null, salt: 0 },
  });
  assert.equal(base.protein, null);
  assert.equal(base.carbs, null);
  assert.equal(base.salt, 0);
});

test("missing allocated lots block serving guidance and logging rather than silently shrinking the portion", () => {
  const m = {
    ...meal,
    batchId: "lot",
    allocations: [
      { batchId: "lot", portions: 0.5 },
      { batchId: "missing", portions: 0.5 },
    ],
  };
  const batches = [lot()];
  assert.equal(servingNutrition({ batches }, m, recipe), null);
  const html = render({ m, batches });
  assert.match(html, /allocated amount cannot be verified/);
  assert.match(html, /Stored portions are unavailable/);
  assert.doesNotMatch(
    html,
    /class="serving-guide"|data-action="eat"|0.5 allocated portions/,
  );
  assert.equal(
    servingNutrition({ batches }, { ...m, allocations: [] }, recipe),
    null,
  );
});

test("frozen portions require defrost confirmation before logging", () => {
  const html = render({
    m: { ...meal, batchId: "lot" },
    batches: [lot({ location: "freezer" })],
  });
  assert.match(html, /Defrost before serving/);
  assert.match(html, /data-op="thaw"/);
  assert.doesNotMatch(html, /data-action="eat"|data-action="prepare"/);
});

test("expired timestamps and legacy dates override frozen actions and suppress serving guidance", () => {
  for (const batch of [
    lot({ expires: "2000-01-01" }),
    lot({ safeUntil: "2000-01-01T12:00:00Z" }),
    lot({ location: "freezer", expires: "2000-01-01" }),
  ]) {
    assert.ok(expired(batch));
    const html = render({ m: { ...meal, batchId: "lot" }, batches: [batch] });
    assert.match(html, /past its recorded safe-use time/);
    assert.doesNotMatch(
      html,
      /class="serving-guide"|data-op="thaw"|data-action="eat"/,
    );
  }
  const validToday = lot({ expires: dayKey() });
  assert.ok(!expired(validToday));
  assert.match(
    render({ m: { ...meal, batchId: "lot" }, batches: [validToday] }),
    /data-action="eat"/,
  );
});

test("eaten meals display the actual diary snapshot even if the batch no longer exists", () => {
  const m = {
    ...meal,
    batchId: "removed",
    status: "eaten",
    actualNutrition: { kcal: 222, protein: 17 },
  };
  assert.strictEqual(
    servingNutrition({ batches: [] }, m, recipe),
    m.actualNutrition,
  );
  const html = render({ m });
  assert.match(html, /RECORDED MEAL/);
  assert.match(html, /<strong>222<\/strong><small>kcal/);
  assert.match(html, /<strong>—<\/strong><small>carbs · g/);
  assert.match(html, /Saved in your food diary/);
  assert.doesNotMatch(
    html,
    /data-action="(?:eat|prepare|guided)"|class="serving-guide"/,
  );
  assert.equal(
    servingNutrition(
      { batches: [] },
      { ...m, actualNutrition: undefined },
      recipe,
    ),
    null,
  );
});

test("skipped and eating-out meals restore intentionally, without cook-again actions", () => {
  for (const status of ["out", "skipped"]) {
    const html = render({
      m: { ...meal, status, batchId: "lot" },
      batches: [lot()],
    });
    assert.match(html, /Restore meal/);
    assert.doesNotMatch(
      html,
      /data-action="(?:eat|prepare|guided)"|class="serving-guide"/,
    );
  }
  const html = render({ m: null, meals: [] });
  assert.match(html, /RECIPE LIBRARY/);
  assert.match(html, /Preview step-by-step/);
  assert.doesNotMatch(html, /data-action="prepare"/);
});

test("recipe text, quantities and action identifiers are escaped", () => {
  const attack = '<img src=x onerror="alert(1)">';
  const r = {
    ...recipe,
    id: attack,
    title: attack,
    cuisine: attack,
    ingredients: [
      { quantity: attack, unit: attack, name: attack, nutritionSource: attack },
    ],
    steps: [{ title: attack, text: attack }],
  };
  const html = render({ m: { ...meal, id: attack }, r });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("cold and mashed recipes end with chilled storage, not cooking or reheating instructions", () => {
  const cold = recipes.filter(
    (r) => ["cold", "mash"].includes(r.method) && !r.freshAssembly,
  );
  assert.ok(cold.length > 1);
  for (const r of cold) {
    const store = detailedSteps(r, 2).find(
      (step) => step.title === "Portion and store",
    );
    assert.match(store.text, /prepared batch/);
    assert.match(store.text, /Serve chilled/);
    assert.match(store.text, /within 48 hours/);
    assert.doesNotMatch(
      store.text,
      /cooked batch|Cool cooked|Reheat|steaming hot/,
    );
  }
  const riceStorage = detailedSteps(recipeMap["chicken-bean-rice"]).at(-1).text;
  assert.match(riceStorage, /Refrigerated rice must be eaten within 24 hours/);
  assert.match(riceStorage, /Reheat only once/);
  const shakeStorage = detailedSteps(recipeMap["whey-water"]).at(-1).text;
  assert.match(shakeStorage, /drink it now/);
  assert.doesNotMatch(shakeStorage, /within 48 hours|Reheat/);
});

test("recipe header restores active preparation time and distinguishes the original recipe for leftovers", () => {
  const r = { ...recipe, active: 15 };
  assert.match(render({ r }), /<p class="hint">15 min active<\/p>/);
  const leftover = render({
    r,
    m: { ...meal, batchId: "lot" },
    batches: [lot()],
  });
  assert.match(leftover, /Original recipe · 15 min active/);
  assert.doesNotMatch(
    render({ r: { ...r, active: undefined } }),
    /undefined min active/,
  );
});
