import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
const dataDir = await mkdtemp(path.join(tmpdir(), "cookwell-tests-"));
let child;
async function start() {
  child = spawn(process.execPath, ["server.mjs"], {
    env: {
      ...process.env,
      PORT: "4181",
      DATA_DIR: dataDir,
      DATABASE_URL: "",
      VERCEL: "",
      INVITE_CODE: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await once(child.stdout, "data");
}
async function stop() {
  child.kill();
  await once(child, "exit");
}
async function call(action, data, cookie, extra = {}) {
  const res = await fetch("http://127.0.0.1:4181/api/index?action=" + action, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return {
    status: res.status,
    body: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
test("new feature API journey persists imports, split lots, grams eaten and review", async () => {
  await start();
  try {
    assert.equal(
      (await call("barcode", { code: "3017620422003", consent: true })).status,
      401,
    );
    assert.equal(
      (
        await call("swapPreview", {
          id: "private-meal",
          recipeId: "eggs-toast",
          revision: 0,
        })
      ).status,
      401,
    );
    const account = await call("register", {
        email: "new-features@example.test",
        password: "fictional-password-123",
      }),
      cookie = account.cookie;
    let state = account.body.state;
    const act = async (action, data) => {
      const r = await call(
        "mutate",
        { revision: state.revision, action, data },
        cookie,
      );
      assert.equal(r.status, 200, JSON.stringify(r.body));
      state = r.body.state;
      return state;
    };
    await act("profile", {
      name: "Feature test",
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
      startDate: new Date().toISOString().slice(0, 10),
    });
    assert.equal(
      (await call("barcode", { code: "3017620422003", consent: false }, cookie))
        .status,
      400,
    );
    assert.equal(
      (await call("barcode", { code: "invalid", consent: true }, cookie))
        .status,
      400,
    );
    await act("rhythm", {
      planId: state.plans[0].id,
      cooking: "batch",
      cookEveryDays: 3,
      shopEveryDays: 3,
      hobCount: 2,
    });
    assert.equal(state.profile.hobCount, 2);
    assert.equal(state.plans[0].sessions.length, 3);
    assert.equal(state.plans[0].shoppingTrips.length, 3);
    await act("nutritionSettings", {
      mode: "moderate",
      proteinSafety: "none",
      shakes: "never",
    });
    const beforePreview = JSON.stringify(state.plans[0].meals),
      beforeRevision = state.revision;
    const preview = await call(
      "rebalancePreview",
      { planId: state.plans[0].id, revision: state.revision },
      cookie,
    );
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.ok(preview.body.plan.nutritionReport.days.length === 7);
    const afterPreview = (await call("state", null, cookie)).body.state;
    assert.equal(
      JSON.stringify(afterPreview.plans[0].meals),
      beforePreview,
      "Preview must not replace saved meals",
    );
    assert.equal(afterPreview.revision, beforeRevision);
    await act("rebalancePlan", { planId: state.plans[0].id, confirmed: true });
    assert.equal(
      (
        await call(
          "rebalancePreview",
          { planId: state.plans[0].id, revision: beforeRevision },
          cookie,
        )
      ).status,
      409,
    );
    const invalid = await call(
      "mutate",
      {
        revision: state.revision,
        action: "nutritionSettings",
        data: {
          mode: "custom",
          proteinSafety: "none",
          shakes: "never",
          protein: 20,
          carbs: 30,
          fat: 10,
        },
      },
      cookie,
    );
    assert.equal(invalid.status, 400);
    const swapMeal = state.plans[0].meals.find(
        (meal) => meal.status === "planned" && !meal.batchId,
      ),
      replacement = state.catalog.find(
        (recipe) =>
          recipe.allowed &&
          recipe.slots.includes(swapMeal.slot) &&
          recipe.id !== swapMeal.recipeId,
      ),
      swapRevision = state.revision,
      savedBeforeSwap = structuredClone(state);
    assert.ok(replacement, "The test week must have a compatible alternative");
    const invalidSwapPreview = await call(
      "swapPreview",
      {
        id: swapMeal.id,
        recipeId: "recipe-that-does-not-exist",
        revision: swapRevision,
      },
      cookie,
    );
    assert.equal(invalidSwapPreview.status, 400);
    assert.equal(
      (
        await call(
          "swapPreview",
          { id: swapMeal.id, recipeId: replacement.id, revision: swapRevision },
          cookie,
          { Origin: "https://unrelated.test" },
        )
      ).status,
      403,
      "Preview requests retain the same cross-site protection as mutations",
    );
    const swapPreview = await call(
      "swapPreview",
      { id: swapMeal.id, recipeId: replacement.id, revision: swapRevision },
      cookie,
    );
    assert.equal(swapPreview.status, 200, JSON.stringify(swapPreview.body));
    assert.equal(swapPreview.body.revision, swapRevision);
    assert.equal(swapPreview.body.after.meal.recipeId, replacement.id);
    assert.ok(Number.isInteger(swapPreview.body.after.budget.total));
    const savedAfterSwapPreview = (await call("state", null, cookie)).body
      .state;
    assert.equal(savedAfterSwapPreview.revision, swapRevision);
    for (const key of [
      "plans",
      "inventory",
      "batches",
      "purchases",
      "events",
      "profile",
      "logs",
      "foodLogs",
      "reviews",
    ])
      assert.deepEqual(
        savedAfterSwapPreview[key],
        savedBeforeSwap[key],
        `Swap preview must not change ${key}`,
      );
    await act("swap", { id: swapMeal.id, recipeId: replacement.id });
    const swappedPlan = state.plans.find(
        (plan) => plan.id === swapPreview.body.planId,
      ),
      swappedMeal = swappedPlan.meals.find((meal) => meal.id === swapMeal.id),
      swappedDay = swappedPlan.nutritionReport.days.find(
        (day) => day.date === swapMeal.date,
      );
    assert.equal(state.revision, swapRevision + 1);
    assert.equal(swappedMeal.recipeId, swapPreview.body.after.meal.recipeId);
    assert.equal(
      swappedMeal.multiplier,
      swapPreview.body.after.meal.multiplier,
    );
    assert.deepEqual(swappedDay.totals, swapPreview.body.after.day.totals);
    assert.deepEqual(
      swappedDay.assessment,
      swapPreview.body.after.day.assessment,
    );
    assert.deepEqual(swappedPlan.shopping, swapPreview.body.after.shopping);
    assert.deepEqual(swappedPlan.sessions, swapPreview.body.after.sessions);
    assert.equal(
      swappedPlan.nutritionReport.budget.total,
      swapPreview.body.after.budget.total,
    );
    assert.equal(
      (
        await call(
          "swapPreview",
          { id: swapMeal.id, recipeId: replacement.id, revision: swapRevision },
          cookie,
        )
      ).status,
      409,
    );
    const p = state.plans[0],
      m = p.meals.find(
        (m) => !m.parentId && p.meals.some((c) => c.parentId === m.id),
      );
    await act("batchSize", { id: m.id, portions: 6 });
    const r = await call(
      "recipe&id=" + m.recipeId + "&multiplier=" + 6 * m.multiplier,
      null,
      cookie,
    );
    assert.equal(r.status, 200);
    await act("importPurchases", {
      confirmed: true,
      importId: "api-confirmed-import-12345",
      planId: p.id,
      retailer: "Fictional receipt",
      date: new Date().toISOString().slice(0, 10),
      rows: r.body.ingredients.map((i) => ({
        ingredientId: i.id,
        packs: 1,
        pack: i.quantity,
        total: 1,
        location: "cupboard",
      })),
    });
    const savedSpend = state.purchases.reduce((n, p) => n + p.cost, 0);
    const duplicate = await call(
      "mutate",
      {
        revision: state.revision,
        action: "importPurchases",
        data: { confirmed: true, importId: "api-confirmed-import-12345" },
      },
      cookie,
    );
    assert.equal(duplicate.status, 400);
    await act("cook", { id: m.id, cookedWeight: 2400 });
    const b = state.batches[0];
    await act("batch", { id: b.id, operation: "freeze", portions: 2 });
    await act("eat", { id: m.id, basis: "grams", amount: 200 });
    assert.equal(
      state.plans[0].meals.find((x) => x.id === m.id).eatenPortions,
      0.5,
    );
    await act("review", {
      planId: p.id,
      hunger: 3,
      enjoyment: 4,
      effort: 2,
      priority: "variety",
      refreshDraft: true,
    });
    await stop();
    await start();
    state = (await call("state", null, cookie)).body.state;
    assert.equal(
      state.batches.find((x) => x.location === "freezer").remaining,
      2,
    );
    assert.equal(state.reviews.length, 1);
    assert.equal(state.imports.length, 1);
    assert.equal(state.profile.nutritionSettings.mode, "moderate");
    assert.equal(
      state.purchases.reduce((n, p) => n + p.cost, 0),
      savedSpend,
    );
    const asset = await fetch("http://127.0.0.1:4181/features.js");
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /javascript/);
  } finally {
    await stop();
  }
});

test("persistent authenticated journey, isolation, stale writes and recovery", async () => {
  await start();
  try {
    assert.equal((await call("state")).status, 401);
    const account = await call("register", {
      email: "integration@example.test",
      password: "testing-password-123",
    });
    assert.equal(account.status, 200);
    assert.ok(account.cookie);
    assert.ok(account.body.recoveryCode);
    const cookie = account.cookie;
    const p = {
      name: "Integration test",
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
      startDate: new Date().toISOString().slice(0, 10),
    };
    const onboard = await call(
      "mutate",
      { revision: 0, action: "profile", data: p },
      cookie,
    );
    assert.equal(onboard.status, 200);
    assert.equal(onboard.body.state.plans[0].meals.length, 28);
    assert.ok(
      onboard.body.state.plans[0].shopping.reduce((n, r) => n + r.cost, 0) <=
        4000,
      "baseline fits £40 in whole packs",
    );
    const log = await call(
      "mutate",
      {
        revision: 1,
        action: "log",
        data: { type: "glucose", value: 108, unit: "mg/dL", timing: "after" },
      },
      cookie,
    );
    assert.equal(log.status, 200);
    assert.equal(
      (
        await call(
          "mutate",
          { revision: 1, action: "log", data: { type: "steps", value: 100 } },
          cookie,
        )
      ).status,
      409,
    );
    const attack = await call(
      "mutate",
      { revision: 2, action: "log", data: { type: "steps", value: 100 } },
      cookie,
      { Origin: "https://unrelated.test" },
    );
    assert.equal(attack.status, 403);
    const user2 = await call("register", {
      email: "separate@example.test",
      password: "other-testing-password",
    });
    assert.equal(user2.body.state.logs.length, 0);
    assert.equal(user2.body.state.profile, null);
    const otherAccountPreview = await call(
      "swapPreview",
      {
        id: onboard.body.state.plans[0].meals[0].id,
        recipeId: "eggs-toast",
        revision: user2.body.state.revision,
      },
      user2.cookie,
    );
    assert.equal(
      otherAccountPreview.status,
      400,
      "A signed-in account cannot preview another account's meal",
    );
    assert.equal(otherAccountPreview.body.after, undefined);
    const isolatedAfterPreview = (await call("state", null, user2.cookie)).body
      .state;
    assert.deepEqual(isolatedAfterPreview, user2.body.state);
    await stop();
    await start();
    const persisted = await call("state", null, cookie);
    assert.equal(persisted.status, 200);
    assert.equal(persisted.body.state.logs[0].value, 108);
    const saved = JSON.stringify(persisted.body.state.inventory);
    const invalid = await call(
      "mutate",
      {
        revision: 2,
        action: "cook",
        data: { id: persisted.body.state.plans[0].meals[0].id },
      },
      cookie,
    );
    assert.equal(invalid.status, 400);
    assert.equal(
      JSON.stringify((await call("state", null, cookie)).body.state.inventory),
      saved,
    );
    const exp = await call("export", null, cookie);
    assert.equal(exp.body.data.logs.length, 1);
    assert.equal(exp.body.password, undefined);
    const food = await call(
      "mutate",
      {
        revision: 2,
        action: "food",
        data: { name: "Test drink", basis: "portion", quantity: 1, kcal: 125 },
      },
      cookie,
    );
    assert.equal(food.status, 200);
    assert.equal(food.body.state.foodLogs[0].nutrition.kcal, 125);
    assert.equal(food.body.state.foodLogs[0].nutrition.protein, null);
    assert.equal(
      (await call("state", null, cookie)).body.state.foodLogs.length,
      1,
    );
    assert.equal(
      (await call("state", null, user2.cookie)).body.state.foodLogs?.length ||
        0,
      0,
    );
    const reset = await call("recover", {
      email: "integration@example.test",
      password: "replacement-password-123",
      recovery: account.body.recoveryCode,
    });
    assert.equal(reset.status, 200);
    assert.equal((await call("state", null, cookie)).status, 401);
    assert.equal((await call("state", null, user2.cookie)).status, 200);
    const deleted = await call(
      "deleteAccount",
      { password: "replacement-password-123" },
      reset.cookie,
    );
    assert.equal(deleted.status, 200);
    assert.equal((await call("state", null, reset.cookie)).status, 401);
  } finally {
    await stop();
  }
});
