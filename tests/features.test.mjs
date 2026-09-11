import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  applyAction,
  today,
  addDays,
  requirements,
  generatePlan,
  viewState,
} from "../lib/domain.mjs";
import { recipeMap, ingredients } from "../lib/catalog.mjs";
import {
  allocations,
  freePortions,
  reserved,
  yieldInfo,
} from "../public/portions.js";
import { learningBias } from "../lib/reviews.mjs";
import { parseReceipt, validBarcode } from "../public/imports.js";
import { lookupProduct } from "../lib/product-lookup.mjs";
import { createFeatures } from "../public/features.js";
const profile = {
  name: "Fictional cook",
  age: 24,
  height: 175,
  weight: 89.5,
  equationSex: "male",
  activity: 1.375,
  goal: "lose",
  budget: 40,
  equipment: ["hob", "oven", "fridge", "freezer"],
  allergens: [],
  avoid: [],
  diet: "omnivore",
  likes: "",
  cooking: "batch",
  activeLimit: 20,
  explore: 1,
  glucoseUnit: "mg/dL",
  startDate: today(),
  stepsTarget: 7000,
};
function setup() {
  const s = freshState();
  applyAction(s, "profile", profile);
  return s;
}
function prepared(yieldCount = 4) {
  const s = setup(),
    p = s.plans[0],
    m = p.meals.find(
      (m) => !m.parentId && p.meals.some((c) => c.parentId === m.id),
    );
  const count = Math.max(yieldInfo(p, m).group.length, yieldCount);
  applyAction(s, "batchSize", { id: m.id, portions: count });
  for (const i of recipeMap[m.recipeId].items)
    applyAction(s, "stock", {
      ingredientId: i.id,
      quantity: 50000,
      location: "cupboard",
    });
  applyAction(s, "cook", { id: m.id, cookedWeight: count * 400 });
  return { s, p, m, b: s.batches[0] };
}
function invariants(s) {
  for (const b of s.batches) {
    assert.ok(b.remaining >= 0);
    assert.ok(
      reserved(s, b.id) <= b.remaining + 0.000001,
      `over-reserved ${b.id}`,
    );
  }
}
test("custom batch yield scales requirements, stock and measured servings exactly", () => {
  const s = setup(),
    p = s.plans[0],
    m = p.meals[0],
    before = requirements(s, p),
    count = yieldInfo(p, m).portions;
  applyAction(s, "batchSize", { id: m.id, portions: count + 2 });
  const after = requirements(s, p);
  for (const i of recipeMap[m.recipeId].items)
    assert.ok(
      Math.abs(after[i.id] - before[i.id] - i.qty * m.multiplier * 2) < 0.001,
    );
  const { s: ready, b } = prepared(6);
  assert.equal(b.remaining, 6);
  assert.equal(b.gramsPerPortion, 400);
  assert.equal(b.yieldPortions, 6);
  assert.ok(freePortions(ready, b) >= 2);
  invariants(ready);
});
test("half a portion logs half nutrition and releases the uneaten fraction", () => {
  const { s, m, b } = prepared();
  const alreadyFree = freePortions(s, b);
  const before = b.remaining,
    kcal = b.nutrition.kcal;
  applyAction(s, "eat", { id: m.id, amount: 0.5 });
  assert.equal(b.remaining, before - 0.5);
  assert.equal(m.actualNutrition.kcal, Math.round(kcal * 0.5 * 1e6) / 1e6);
  assert.equal(m.eatenGrams, 200);
  assert.equal(freePortions(s, b), alreadyFree + 0.5);
  invariants(s);
  assert.throws(
    () => applyAction(s, "eat", { id: m.id, amount: 0.5 }),
    /Already/,
  );
});
test("eating in grams and splitting fridge/freezer lots preserve allocations", () => {
  const { s, p, m, b } = prepared();
  applyAction(s, "batch", { id: b.id, operation: "freeze", portions: 2.5 });
  const frozen = s.batches.find((x) => x.location === "freezer");
  assert.equal(frozen.remaining, 2.5);
  assert.equal(b.remaining, 1.5);
  invariants(s);
  applyAction(s, "eat", { id: m.id, basis: "grams", amount: 200 });
  assert.equal(m.eatenPortions, 0.5);
  invariants(s);
  const blocked = p.meals.find(
    (x) =>
      x.status === "planned" &&
      allocations(x).length &&
      allocations(x).every((a) => a.batchId === frozen.id),
  );
  assert.ok(blocked);
  assert.throws(() => applyAction(s, "eat", { id: blocked.id }), /Defrost/);
  const before = structuredClone(s.batches);
  assert.throws(
    () =>
      applyAction(s, "batch", {
        id: frozen.id,
        operation: "thaw",
        portions: 1,
      }),
    /Confirm/,
  );
  assert.deepEqual(s.batches, before);
  applyAction(s, "batch", {
    id: frozen.id,
    operation: "thaw",
    portions: 1,
    confirmed: true,
  });
  invariants(s);
  const thawed = s.batches.find((x) => x.thawedAt);
  assert.equal(thawed.remaining, 1);
  assert.throws(
    () => applyAction(s, "batch", { id: thawed.id, operation: "freeze" }),
    /refreeze/,
  );
  applyAction(s, "batchWeight", { id: thawed.id, cookedWeight: 2000 });
  assert.ok(s.batches.every((x) => x.gramsPerPortion === 500));
});
test("fractional waste never over-reserves stock; expired food cannot be rescued by freezing", () => {
  const { s, b } = prepared();
  applyAction(s, "batch", { id: b.id, operation: "waste", portions: 0.25 });
  assert.equal(s.waste[0].portions, 0.25);
  invariants(s);
  b.safeUntil = new Date(Date.now() - 1000).toISOString();
  assert.throws(
    () =>
      applyAction(s, "batch", { id: b.id, operation: "freeze", portions: 1 }),
    /use-by/,
  );
});
test("legacy whole-portion batches remain usable", () => {
  const { s, p, m, b } = prepared();
  for (const meal of p.meals) delete meal.allocations;
  delete b.yieldPortions;
  delete b.gramsPerPortion;
  delete b.cookedWeight;
  applyAction(s, "batch", { id: b.id, operation: "freeze", portions: 1 });
  applyAction(s, "batchWeight", { id: b.id, cookedWeight: 1600 });
  assert.equal(b.gramsPerPortion, 400);
  assert.ok(s.batches.every((lot) => lot.gramsPerPortion === 400));
  applyAction(s, "eat", { id: m.id, amount: 0.5 });
  assert.equal(m.eatenGrams, 200);
  invariants(s);
});
test("weekly review upserts ratings and safely rebuilds an unused draft", () => {
  const s = setup(),
    p = s.plans[0],
    target = s.profile.calorieTarget;
  generatePlan(s, addDays(p.start, 7), true);
  const old = s.plans[1].id;
  const data = {
    planId: p.id,
    hunger: 4,
    enjoyment: 3,
    effort: 5,
    priority: "budget",
    ratings: [{ recipeId: p.meals[0].recipeId, rating: "love" }],
    refreshDraft: true,
  };
  applyAction(s, "review", data);
  assert.equal(s.reviews.length, 1);
  assert.notEqual(s.plans[1].id, old);
  assert.equal(s.profile.calorieTarget, target);
  applyAction(s, "review", { ...data, refreshDraft: false });
  assert.equal(s.reviews.length, 1);
  assert.equal(s.feedback.filter((f) => f.reviewId).length, 1);
  const r = recipeMap[p.meals[0].recipeId];
  assert.ok(learningBias(s, r, 200) < learningBias(s, r, 100));
  s.plans[1].status = "active";
  assert.throws(() => applyAction(s, "review", data), /already in use/);
  assert.equal(s.logs.length, 0);
});
test("receipt parser excludes totals, discounts and refunds and never preselects rows", () => {
  const result = parseReceipt(
    "TESCO\nOATS 1.25\n2 x CHICKPEAS 3.00\nDISCOUNT -0.50\nTOTAL 3.75\nVISA 3.75\nREFUND 1.00",
    ingredients,
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1].packs, 2);
  assert.equal(result.rows[1].total, 3);
  assert.ok(result.rows.every((r) => !r.include && r.pack === ""));
  assert.equal(result.rows[0].ingredientId, "oats");
});
test("barcode check digits and product lookup handle missing data without inventing nutrients", async () => {
  assert.ok(validBarcode("3017620422003"));
  assert.ok(!validBarcode("3017620422004"));
  const result = await lookupProduct("3017620422003", async (url, options) => {
    assert.ok(
      url.startsWith("https://world.openfoodfacts.org/api/v2/product/"),
    );
    assert.ok(options.headers["User-Agent"]);
    return {
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: "Oats",
          product_quantity: 500,
          product_quantity_unit: "g",
          nutriments: { "energy-kcal_100g": 380 },
        },
      }),
    };
  });
  assert.equal(result.pack, 500);
  assert.equal(result.ingredientId, "oats");
  assert.equal(result.nutrition.protein, null);
  assert.equal(result.nutrition.kcal, 380);
  assert.equal(
    (await lookupProduct("3017620422003", async () => ({ status: 404 }))).found,
    false,
  );
  await assert.rejects(
    () =>
      lookupProduct("3017620422003", async () => {
        throw new Error("offline");
      }),
    /unavailable/,
  );
});
function purchaseData(s) {
  return {
    importId: "fictional-import-12345",
    confirmed: true,
    planId: s.plans[0].id,
    date: today(),
    retailer: "Test shop",
    rows: [
      {
        ingredientId: "oats",
        packs: 2,
        pack: 500,
        total: 2.5,
        location: "cupboard",
      },
    ],
  };
}
test("confirmed import saves exact line cost and stock once with all-row validation", () => {
  const s = setup(),
    data = purchaseData(s),
    before = structuredClone(s);
  assert.throws(
    () =>
      applyAction(s, "importPurchases", {
        ...data,
        rows: [...data.rows, { ...data.rows[0], ingredientId: "unknown" }],
      }),
    /Match/,
  );
  assert.deepEqual(s, before);
  assert.throws(
    () => applyAction(s, "importPurchases", { ...data, confirmed: false }),
    /confirm/,
  );
  applyAction(s, "importPurchases", data);
  assert.equal(s.inventory[0].quantity, 1000);
  assert.equal(s.purchases[0].cost, 250);
  assert.equal(s.prices.oats.price, 125);
  assert.equal(s.imports[0].total, 250);
  assert.throws(() => applyAction(s, "importPurchases", data), /already saved/);
  assert.equal(s.purchases.length, 1);
});
test("receipt and product UI require selected verified rows and connect to mutations", async () => {
  const s = setup();
  let html = "",
    last;
  const helpers = {
    getState: () => viewState(s),
    chosenPlan: () => s.plans[0],
    mealInfo: (id) => {
      const m = s.plans[0].meals.find((m) => m.id === id);
      return {
        m,
        p: s.plans[0],
        batch: s.batches.find((b) => b.id === m.batchId),
      };
    },
    modal: (h) => (html = h),
    mutate: async (a, d) => {
      last = { a, d };
      applyAction(s, a, d);
      return true;
    },
    api: async () => ({ found: false }),
    esc: String,
    field: (l, n) => `<input name="${n}">`,
    select: (l, n) => `<select name="${n}"></select>`,
    btn: (l, a) => `<button data-action="${a}">${l}</button>`,
    cash: (n) => "£" + n / 100,
    toast: () => {},
    openMeal: async () => {},
  };
  const f = createFeatures(helpers);
  await f.click("purchase-import");
  assert.match(html, /receipt-form/);
  assert.match(html, /barcode-form/);
  await f.submit({ id: "receipt-form", dataset: {} }, { text: "OATS 1.25" });
  assert.match(html, /include-0/);
  assert.doesNotMatch(html, /<input[^>]*\schecked/);
  await f.submit(
    { id: "import-form", dataset: {} },
    {
      "include-0": "on",
      "ingredient-0": "oats",
      "packs-0": "1",
      "pack-0": "1000",
      "total-0": "1.25",
      "location-0": "cupboard",
      retailer: "Test shop",
      date: today(),
      planId: s.plans[0].id,
      confirmed: "on",
    },
  );
  assert.equal(last.a, "importPurchases");
  assert.equal(s.inventory[0].quantity, 1000);
  await f.click("weekly-review");
  assert.match(html, /review-form/);
  assert.match(html, /refreshDraft/);
  assert.match(f.batchSummary(s.plans[0].meals[0]), /1 cooking batch/);
  await f.click("prepare", s.plans[0].meals[0].id);
  assert.match(html, /cookedWeight/);
});
