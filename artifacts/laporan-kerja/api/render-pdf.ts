import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const MAX_DOCUMENT_SIZE = 4 * 1024 * 1024;

const safeFileName = (value: unknown) => {
  const name = typeof value === "string" ? value : "rekap";
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return `${sanitized.replace(/\.pdf$/i, "") || "rekap"}.pdf`;
};

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
    if (typeof documentHtml !== "string" || !documentHtml.includes("recap-print-area")) {
      return errorResponse("Dokumen rekap untuk dicetak tidak valid.", 400);
    }
    if (new TextEncoder().encode(documentHtml).byteLength > MAX_DOCUMENT_SIZE) {
      return errorResponse("Rekap terlalu besar untuk dibuatkan PDF.", 413);
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
      await page.setContent(documentHtml, { waitUntil: "load", timeout: 40_000 });
      await page.emulateMediaType("print");
      await page.addStyleTag({ content: `
        @media print {
          table:not(.continuation-table) thead { display: table-header-group !important; }
          table.continuation-table thead { display: none !important; }
          table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      ` });
      await page.evaluate("document.querySelectorAll('table:not(.continuation-table) thead').forEach((header) => header.style.setProperty('display', 'table-header-group', 'important'))");

      const pdf = await page.pdf({
        format: "A3",
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      });

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
