import { build } from "esbuild";
import { resolve } from "node:path";
import { mkdir, copyFile, readdir } from "node:fs/promises";
await mkdir("public/vendor/ocr", { recursive: true });
await build({
  absWorkingDir: process.cwd(),
  tsconfigRaw: {},
  entryPoints: [resolve("client/capture.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["safari15", "chrome100"],
  minify: true,
  outfile: resolve("public/vendor/capture.js"),
  legalComments: "linked",
});
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/vendor/ocr/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core"))
  if (/^tesseract-core.*\.wasm(\.js)?$/.test(file))
    await copyFile(
      "node_modules/tesseract.js-core/" + file,
      "public/vendor/ocr/" + file,
    );
await copyFile(
  "node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz",
  "public/vendor/ocr/eng.traineddata.gz",
);
console.log("Built local receipt OCR and barcode assets.");
