import test from "node:test";
import assert from "node:assert/strict";
import {
  createShopExperience,
  shoppingCoverage,
  shoppingPrice,
} from "../public/shop-experience.js";
const escape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");

test("fresh shakes offer no freezer-batch action", () => {
  const { ui, state } = setup();
  state.catalog[0].freshAssembly = true;
  state.batches.push({
    id: "shake",
    recipeId: "curry",
    remaining: 1,
    location: "fridge",
    expires: "2099-01-01",
  });
  ui.click("shop-tab", "kitchen");
  const html = ui.render();
  assert.ok(
    html.includes("Freshly mixed shakes are not stored as freezer batches"),
  );
  assert.ok(!html.includes('data-op="freeze"'));
  assert.ok(html.includes('data-op="waste"'));
});
const row = {
  id: "rice",
  name: "Brown rice",
  group: "Cupboard",
  unit: "g",
  need: 1200,
  have: 0,
  packs: 2,
  cost: 320,
  price: {
    price: 160,
    pack: 1000,
    source: "Estimate — check your pack",
    checkedAt: null,
  },
};
function setup() {
  let state = {
      revision: 1,
      inventory: [],
      batches: [],
      ingredients: [{ id: "rice", name: "Brown rice", unit: "g" }],
      catalog: [{ id: "curry", title: "Chicken curry" }],
    },
    trip = "",
    plan = {
      id: "week-a",
      start: "2026-09-14",
      shopping: [structuredClone(row)],
      shoppingTrips: [
        {
          date: "2026-09-14",
          through: "2026-09-20",
          rows: [structuredClone(row)],
        },
      ],
    },
    content = "";
  const calls = [],
    ui = createShopExperience({
      getState: () => state,
      chosenPlan: () => plan,
      esc: escape,
      btn: (label, action, attributes = "") =>
        `<button data-action="${action}" ${attributes}>${label}</button>`,
      cash: (pence) => "£" + (pence / 100).toFixed(2),
      dateLabel: (date) => date,
      modal: (html) => {
        content = html;
      },
      mutate: async (action, data) => {
        calls.push({ action, data });
        state = { ...state, revision: state.revision + 1 };
        return true;
      },
      render: () => {},
      getTripDate: () => trip,
      setTripDate: (value) => {
        trip = value;
      },
    });
  return {
    ui,
    calls,
    get content() {
      return content;
    },
    get state() {
      return state;
    },
    get plan() {
      return plan;
    },
    setState: (value) => {
      state = value;
    },
    setPlan: (value) => {
      plan = value;
    },
    setTrip: (value) => {
      trip = value;
    },
    pick: (id = "rice") =>
      ui.input({ dataset: { shopSelect: id }, checked: true }),
  };
}

test("shopping checklist starts empty and selection/review never records a purchase", async () => {
  const x = setup();
  assert.match(x.ui.render(), /0 selected/);
  assert.equal(x.calls.length, 0);
  x.pick();
  assert.match(x.ui.render(), /1 selected/);
  await x.ui.click("shop-review");
  assert.match(x.content, /Total paid for this item/);
  assert.match(x.content, /name="total-0" type="number" value=""/);
  assert.doesNotMatch(x.content, /name="confirmed" checked/);
  assert.equal(x.calls.length, 0);
});

test("selection is isolated across revisions, weeks, trips and account state objects", () => {
  for (const change of [
    (x) => {
      x.state.revision++;
    },
    (x) => x.setPlan({ ...x.plan, id: "week-b" }),
    (x) => x.setTrip("2026-09-14"),
    (x) => x.setState(structuredClone(x.state)),
  ]) {
    const x = setup();
    x.ui.render();
    x.pick();
    assert.match(x.ui.render(), /1 selected/);
    change(x);
    assert.match(x.ui.render(), /0 selected/);
  }
});

test("checkout requires confirmation and actual paid totals then sends only edited purchase rows", async () => {
  const x = setup();
  x.ui.render();
  x.pick();
  await x.ui.click("shop-review");
  const form = { id: "shop-purchase-form" },
    data = {
      retailer: "My local shop",
      date: "2026-09-14",
      "include-0": "on",
      "packs-0": "3",
      "pack-0": "750",
      "total-0": "4.10",
      "location-0": "cupboard",
      "expires-0": "2027-01-01",
    };
  await assert.rejects(() => x.ui.submit(form, data), /confirm/);
  assert.equal(x.calls.length, 0);
  await assert.rejects(
    () => x.ui.submit(form, { ...data, confirmed: "on", "total-0": "" }),
    /actual amount paid/,
  );
  assert.equal(x.calls.length, 0);
  await x.ui.submit(form, { ...data, confirmed: "on" });
  assert.equal(x.calls.length, 1);
  assert.equal(x.calls[0].action, "importPurchases");
  assert.equal(x.calls[0].data.confirmed, true);
  assert.equal(x.calls[0].data.planId, "week-a");
  assert.deepEqual(x.calls[0].data.rows, [
    {
      ingredientId: "rice",
      packs: "3",
      pack: "750",
      total: "4.10",
      location: "cupboard",
      expires: "2027-01-01",
    },
  ]);
  assert.match(x.calls[0].data.importId, /^[a-zA-Z0-9-]{12,80}$/);
  assert.match(x.ui.render(), /0 selected/);
  await assert.rejects(
    () => x.ui.submit(form, { ...data, confirmed: "on" }),
    /list changed/,
  );
  assert.equal(x.calls.length, 1);
});

test("a purchase review cannot be submitted after its list changes", async () => {
  const x = setup();
  x.ui.render();
  x.pick();
  await x.ui.click("shop-review");
  x.setTrip("2026-09-14");
  await assert.rejects(
    () => x.ui.submit({ id: "shop-purchase-form" }, { confirmed: "on" }),
    /list changed/,
  );
  assert.equal(x.calls.length, 0);
});

test("unknown prices stay unknown and projected pack leftovers are not shown as actual stock", () => {
  const x = setup(),
    unknown = {
      ...row,
      id: "unknown",
      price: {},
      cost: undefined,
      have: 700,
      haveActual: 200,
    };
  x.plan.shopping.push(unknown);
  assert.equal(shoppingPrice(unknown).known, false);
  assert.equal(shoppingPrice(unknown).total, null);
  assert.deepEqual(shoppingCoverage(unknown), { actual: 200, forecast: 500 });
  const html = x.ui.render();
  assert.match(html, /£3.20 known \+ 1 unpriced item/);
  assert.match(html, /Price needed/);
  assert.match(html, /200 g in stock · 500 g forecast from earlier trips/);
  assert.doesNotMatch(html, /NaN/);
});

test("My kitchen preserves actual stock and cooked portion actions without inventing inventory", async () => {
  const x = setup();
  await x.ui.click("shop-tab", "kitchen");
  assert.match(x.ui.render(), /Start with your cupboards/);
  x.state.inventory.push({
    id: "stock-one",
    ingredientId: "rice",
    quantity: 120,
    location: "cupboard",
    expires: "2027-01-01",
  });
  x.state.batches.push({
    id: "batch-one",
    recipeId: "curry",
    remaining: 2,
    portions: 3,
    location: "freezer",
    expires: "2026-10-01",
  });
  const html = x.ui.render();
  assert.match(html, /120 <span>g/);
  for (const action of ["stock", "batch-weight", "use-batch-dialog", "batch"])
    assert.ok(html.includes(`data-action="${action}"`), action);
  assert.match(html, /data-op="thaw"/);
  assert.match(html, /data-op="waste"/);
  assert.equal(x.calls.length, 0);
});
