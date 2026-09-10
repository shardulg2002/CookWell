import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import handler from "./api/index.js";
const root = path.resolve("public");
const types = {
  ".wasm":"application/wasm",
  ".gz":"application/gzip",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api")) return handler(req, res);
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    const bytes = await readFile(file);
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-cache");
    res.end(bytes);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
server.listen(Number(process.env.PORT) || 4173, "127.0.0.1", () =>
  console.log("CookWell: http://localhost:" + (process.env.PORT || 4173)),
);
