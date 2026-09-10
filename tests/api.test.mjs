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
