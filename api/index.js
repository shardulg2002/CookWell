import {
  transaction,
  createAccount,
  newSession,
  matches,
  hash,
  passwordHash,
} from "../lib/store.mjs";
import {
  applyAction,
  viewState,
  getRecipe,
  recommend,
  number,
} from "../lib/domain.mjs";
import { lookupProduct } from "../lib/product-lookup.mjs";
import { previewSwap } from "../lib/swap-preview.mjs";
const reject = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const safeEqual = (a, b) =>
  typeof a === "string" && typeof b === "string" && hash(a) === hash(b);
const cookieName = "cookwell_session";
function cookie(res, email, token, clear = false) {
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${clear ? "" : encodeURIComponent(email) + "~" + token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${clear ? 0 : 2592000}${process.env.VERCEL ? "; Secure" : ""}`,
  );
}
function session(req) {
  try {
    const value = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!value) return null;
    const [email, token] = value.split("~");
    return { email: decodeURIComponent(email), token };
  } catch {
    return null;
  }
}
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let result = "";
  for await (const chunk of req) {
    result += chunk;
    if (result.length > 100000) reject("Request is too large.", 413);
  }
  return result ? JSON.parse(result) : {};
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method === "OPTIONS") {
      res.statusCode = 405;
      res.end();
      return;
    }
    const action =
      new URL(req.url, "http://localhost").searchParams.get("action") ||
      "state";
    if (!["GET", "POST"].includes(req.method))
      reject("Method not allowed.", 405);
    if (req.method === "POST") {
      if (req.headers["content-type"]?.split(";")[0] !== "application/json")
        reject("Send JSON.", 415);
      if (req.headers.origin) {
        let origin;
        try {
          origin = new URL(req.headers.origin).host;
        } catch {
          reject("Invalid origin.", 403);
        }
        if (origin !== req.headers.host)
          reject("Cross-site request blocked.", 403);
      }
    }
    const data = req.method === "POST" ? await body(req) : {};
    if (["register", "login", "recover"].includes(action)) {
      if (req.method !== "POST") reject("POST required.", 405);
      const email = String(data.email || "")
        .trim()
        .toLowerCase();
      if (!/^[^\s@~]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        reject("Enter a valid email.");
      const password = String(data.password || "");
      if (password.length < 12 || password.length > 128)
        reject("Use a password between 12 and 128 characters.");
      const result = await transaction(email, async (record) => {
        if (action === "register") {
          if (process.env.VERCEL && !process.env.INVITE_CODE)
            reject("Set INVITE_CODE before opening registration.", 503);
          if (
            process.env.INVITE_CODE &&
            !safeEqual(data.invite, process.env.INVITE_CODE)
          )
            reject("Incorrect invitation code.", 403);
          if (record) reject("An account already exists. Sign in instead.");
          const created = createAccount(email, password);
          record = created.record;
          const token = newSession(record);
          cookie(res, email, token);
          return {
            account: record,
            result: {
              recoveryCode: created.recovery,
              state: viewState(record.state),
            },
          };
        }
        if (!record) reject("Unable to sign in with those details.", 401);
        record.failures = (record.failures || []).filter(
          (t) => t > Date.now() - 15 * 60000,
        );
        if (record.failures.length >= 10)
          return {
            account: record,
            result: {
              authError: "Too many attempts. Try again in 15 minutes.",
              status: 429,
            },
          };
        const okay =
          action === "recover"
            ? safeEqual(hash(String(data.recovery || "")), record.recoveryHash)
            : matches(password, record.password);
        if (!okay) {
          record.failures.push(Date.now());
          return {
            account: record,
            result: {
              authError: "Unable to sign in with those details.",
              status: 401,
            },
          };
        }
        if (action === "recover") {
          record.password = passwordHash(password);
          record.sessions = [];
        }
        record.failures = [];
        cookie(res, email, newSession(record));
        return { account: record, result: { state: viewState(record.state) } };
      });
      if (result.authError) reject(result.authError, result.status);
      res.end(JSON.stringify(result));
      return;
    }
    const auth = session(req);
    if (!auth) reject("Sign in to continue.", 401);
    const result = await transaction(auth.email, async (account) => {
      if (
        !account ||
        !account.sessions.some(
          (s) => s.hash === hash(auth.token || "") && s.expires > Date.now(),
        )
      )
        reject("Your session expired. Sign in again.", 401);
      if (action === "logout") {
        if (req.method !== "POST") reject("POST required.", 405);
        account.sessions = account.sessions.filter(
          (s) => s.hash !== hash(auth.token),
        );
        cookie(res, "", "", true);
        return { account, result: { ok: true } };
      }
      if (action === "state")
        return { account, result: { state: viewState(account.state) } };
      if (action === "export") {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="cookwell-export.json"',
        );
        return {
          account,
          result: {
            exportedAt: new Date().toISOString(),
            email: account.email,
            data: account.state,
          },
        };
      }
      if (action === "recipe") {
        const params = new URL(req.url, "http://localhost").searchParams;
        return {
          account,
          result: getRecipe(
            account.state,
            params.get("id"),
            number(
              params.get("multiplier") || 1,
              0.1,
              100,
              "Portion multiplier",
            ),
          ),
        };
      }
      if (req.method !== "POST") reject("POST required.", 405);
      if (action === "barcode") {
        if (data.consent !== true)
          reject("Confirm barcode-only lookup before continuing.");
        account.lookups = (account.lookups || []).filter(
          (t) => t > Date.now() - 60000,
        );
        if (account.lookups.length >= 20)
          reject("Too many lookups. Wait a minute and try again.", 429);
        account.lookups.push(Date.now());
        return { account, result: await lookupProduct(data.code) };
      }
      if (action === "recommend") {
        if (!account.state.profile) reject("Complete onboarding.");
        return {
          account,
          result: {
            provider: "Library search — no AI cost",
            recipes: recommend(account.state, data.query, data.slot),
          },
        };
      }
      if (action === "deleteAccount") {
        if (!matches(String(data.password || ""), account.password))
          reject("Password is incorrect.", 401);
        cookie(res, "", "", true);
        return { account: null, result: { ok: true } };
      }
      if (action === "swapPreview") {
        if (data.revision !== account.state.revision)
          reject("Your data changed. Refresh before previewing a swap.", 409);
        return { account, result: previewSwap(account.state, data) };
      }
      if (action === "rebalancePreview") {
        if (data.revision !== account.state.revision)
          reject(
            "Your data changed. Refresh before previewing a new balance.",
            409,
          );
        const draft = structuredClone(account.state);
        applyAction(draft, "rebalancePlan", {
          planId: data.planId,
          confirmed: true,
        });
        const plan = viewState(draft).plans.find((p) => p.id === data.planId);
        return { account, result: { plan, revision: account.state.revision } };
      }
      if (action !== "mutate") reject("Unknown endpoint.", 404);
      if (data.revision !== account.state.revision)
        reject(
          "Your data changed in another tab. Refresh before trying again.",
          409,
        );
      // Mutations happen in a DB transaction; validation failure cannot partially deduct stock.
      applyAction(account.state, data.action, data.data);
      return { account, result: { state: viewState(account.state) } };
    });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = e.status || 500;
    res.end(
      JSON.stringify({
        error: e.status
          ? e.message
          : e instanceof SyntaxError
            ? "Invalid JSON."
            : "Unable to complete this request. Please try again.",
      }),
    );
    if (!e.status) console.error(e.message);
  }
}
