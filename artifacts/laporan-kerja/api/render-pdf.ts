import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import {
  safeFileName,
  validatePdfPayload,
  PDF_PRINT_STYLES,
  PDF_THEAD_SCRIPT,
  PDF_PAGE_OPTIONS,
} from "./pdf-core.js";

const errorResponse = (message: string, status = 500) =>
  Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") return errorResponse("Metode tidak didukung.", 405);

    let payload: { documentHtml?: unknown; fileName?: unknown };
    try {
      payload = await request.json();
    } catch {
      return errorResponse("Data PDF tidak valid.", 400);
    }

    const { documentHtml, fileName } = payload;

    const validationError = validatePdfPayload(documentHtml);
    if (validationError) {
      return errorResponse(validationError, validationError.includes("besar") ? 413 : 400);
    }

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
      chromium.setGraphicsMode = false;
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
        executablePath: await chromium.executablePath(),
        headless: "shell",
      });

      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setContent(documentHtml as string, { waitUntil: "load", timeout: 40_000 });
      await page.emulateMediaType("print");
      await page.addStyleTag({ content: PDF_PRINT_STYLES });
      await page.evaluate(PDF_THEAD_SCRIPT);

      const pdf = await page.pdf(PDF_PAGE_OPTIONS);

      return new Response(pdf as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${safeFileName(fileName)}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("Vercel PDF rendering failed", error);
      return errorResponse("Mesin pembuat PDF tidak tersedia. Coba lagi beberapa saat.");
    } finally {
      await browser?.close();
    }
  },
};
