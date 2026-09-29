import { Router } from "express";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import {
  safeFileName,
  validatePdfPayload,
  PDF_PRINT_STYLES,
  PDF_THEAD_SCRIPT,
  PDF_PAGE_OPTIONS,
} from "../lib/pdf-core.js";

const router = Router();
const LOCAL_CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

router.post("/render-pdf", async (req, res) => {
  const { documentHtml, fileName } = req.body ?? {};

  const validationError = validatePdfPayload(documentHtml);
  if (validationError) {
    res.status(validationError.includes("besar") ? 413 : 400).json({ message: validationError });
    return;
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(existsSync(LOCAL_CHROME_PATH) ? { executablePath: LOCAL_CHROME_PATH } : {}),
      args: ["--disable-gpu", "--disable-software-rasterizer", "--no-sandbox"],
    });

    // JavaScript diaktifkan agar Playwright bisa menerapkan style cetak.
    const page = await browser.newContext().then((ctx) => ctx.newPage());
    await page.setContent(documentHtml as string, { waitUntil: "load", timeout: 45_000 });
    await page.emulateMedia({ media: "print" });
    await page.addStyleTag({ content: PDF_PRINT_STYLES });
    await page.evaluate(PDF_THEAD_SCRIPT);

    const pdf = await page.pdf(PDF_PAGE_OPTIONS);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName(fileName)}"`,
      "Cache-Control": "no-store",
    });
    res.send(pdf);
  } catch (error) {
    console.error("PDF rendering failed", error);
    res.status(500).json({ message: "Mesin pembuat PDF tidak tersedia. Coba lagi beberapa saat." });
  } finally {
    await browser?.close();
  }
});

export default router;
