import { createWorker } from "tesseract.js";
import { BrowserMultiFormatReader } from "@zxing/browser";
// Normalize browser-supported images to PNG; the OCR engine does not accept SVG/HEIC bytes directly.
async function receiptImage(file) {
  const url = URL.createObjectURL(file),
    img = new Image();
  try {
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 64000000)
      throw new Error("Image is too large. Choose a smaller receipt photo.");
    const scale = Math.min(
      1,
      2800 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error(
      "Unable to open this image. Try a JPEG or PNG photo, or paste the receipt text.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function receiptText(file, progress) {
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Choose a receipt image under 12 MB.");
  const source = await receiptImage(file);
  let worker,
    rejectJob,
    ended = false;
  const failure = new Promise((_, reject) => {
    rejectJob = reject;
  });
  const timeout = setTimeout(
    () =>
      rejectJob(
        new Error(
          "Receipt reading timed out. Try a smaller, clearer photo or paste the text.",
        ),
      ),
    90000,
  );
  const creation = createWorker("eng", 1, {
    workerPath: "/vendor/ocr/worker.min.js",
    corePath: "/vendor/ocr",
    langPath: "/vendor/ocr",
    logger: (m) => progress?.(m.status, Math.round((m.progress || 0) * 100)),
    cacheMethod: "none",
    errorHandler: (error) => rejectJob(new Error(String(error))),
  });
  creation.then((value) => {
    if (ended) value.terminate();
    else worker = value;
  }, rejectJob);
  try {
    worker = await Promise.race([creation, failure]);
    const result = await Promise.race([worker.recognize(source), failure]);
    return result.data.text;
  } finally {
    ended = true;
    clearTimeout(timeout);
    await worker?.terminate();
  }
}
export async function barcodeFromImage(file) {
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Choose a barcode photo under 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
    return result.getText();
  } catch {
    throw new Error(
      "Could not read that barcode. Try a sharp, close-up photo with the whole barcode visible, or type the digits.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
