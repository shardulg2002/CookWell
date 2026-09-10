import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { freshState } from "./domain.mjs";
let pool, ready;
let queue = Promise.resolve();
const dataDir = process.env.DATA_DIR || path.resolve(".data");
export function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function matches(password, stored) {
  const [salt, h] = stored.split(":");
  const b = Buffer.from(h, "hex"),
    a = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function database() {
  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
    ready = pool.query(
      "CREATE TABLE IF NOT EXISTS cookwell_accounts (email TEXT PRIMARY KEY, data JSONB NOT NULL)",
    );
  }
  await ready;
  return pool;
}
// Account records are locked per transaction; local mode serialises and atomically replaces its file.
export async function transaction(email, fn) {
  if (process.env.DATABASE_URL) {
    const p = await database(),
      client = await p.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);
      const row = await client.query(
        "SELECT data FROM cookwell_accounts WHERE email=$1 FOR UPDATE",
        [email],
      );
      const record = row.rows[0]?.data || null;
      const { account, result } = await fn(record);
      if (account)
        await client.query(
          "INSERT INTO cookwell_accounts(email,data) VALUES($1,$2::jsonb) ON CONFLICT(email) DO UPDATE SET data=EXCLUDED.data",
          [email, JSON.stringify(account)],
        );
      else if (record)
        await client.query("DELETE FROM cookwell_accounts WHERE email=$1", [
          email,
        ]);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  if (process.env.VERCEL)
    throw Object.assign(
      new Error("Configure DATABASE_URL before using accounts on Vercel."),
      { status: 503 },
    );
  const job = queue.then(async () => {
    await mkdir(dataDir, { recursive: true });
    const file = path.join(dataDir, "accounts.json");
    let records = {};
    try {
      records = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const { account, result } = await fn(records[email] || null);
    if (account) records[email] = account;
    else delete records[email];
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify(records), { mode: 0o600 });
    await rename(tmp, file);
    return result;
  });
  queue = job.catch(() => {});
  return job;
}
export function createAccount(email, password) {
  const recovery = randomBytes(24).toString("hex");
  return {
    record: {
      email,
      password: passwordHash(password),
      recoveryHash: hash(recovery),
      createdAt: Date.now(),
      sessions: [],
      failures: [],
      state: freshState(),
    },
    recovery,
  };
}
export function newSession(account) {
  const token = randomBytes(32).toString("hex");
  account.sessions = account.sessions
    .filter((s) => s.expires > Date.now())
    .slice(-9);
  account.sessions.push({
    hash: hash(token),
    expires: Date.now() + 30 * 86400000,
  });
  return token;
}
export async function closeDatabase() {
  if (pool) await pool.end();
}
