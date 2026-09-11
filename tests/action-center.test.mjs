import test from "node:test";
import assert from "node:assert/strict";
import { actionItems } from "../public/action-center.js";

const day = "2026-09-11";
const plan = {
  id: "week-1",
  start: "2026-09-05",
  sessions: [
    {
      id: "week-1:2026-09-10",
      date: "2026-09-10",
      dishes: [{ portions: 3 }, { portions: 2 }],
    },
  ],
  shoppingTrips: [{ date: "2026-09-11", rows: [{ packs: 1 }, { packs: 0 }] }],
};

test("action centre prioritises overdue cooking and time-sensitive stock", () => {
  const state = {
    ingredients: [{ id: "spinach", name: "Spinach", unit: "g" }],
    inventory: [
      {
        id: "stock-1",
        ingredientId: "spinach",
        quantity: 120,
        location: "fridge",
        expires: day,
      },
    ],
    batches: [],
    catalog: [],
    reviews: [],
    logs: [],
  };
  const items = actionItems(state, plan, day);
  assert.equal(items[0].id, "cook:week-1:2026-09-10");
  assert.ok(items.some((item) => item.id === "stock:stock-1"));
  assert.ok(items.some((item) => item.id === "shop:2026-09-11"));
  assert.ok(items.some((item) => item.kind === "review"));
  assert.equal(items.at(-1).kind, "checkin");
});

test("completed reviews and a daily health entry remove their prompts", () => {
  const items = actionItems(
    {
      ingredients: [],
      inventory: [],
      batches: [],
      catalog: [],
      reviews: [{ planId: plan.id }],
      logs: [{ type: "steps", date: day }],
    },
    { ...plan, sessions: [], shoppingTrips: [] },
    day,
  );
  assert.deepEqual(items, []);
});

test("the centre stays quiet without an active plan", () => {
  assert.deepEqual(actionItems({}, null, day), []);
});
