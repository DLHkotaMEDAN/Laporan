import { Router } from "express";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const router = Router();
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const LOCAL_CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const safeFileName = (value: unknown) => {
  const name = typeof value === "string" ? value : "rekap";
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return `${sanitized.replace(/\.pdf$/i, "") || "rekap"}.pdf`;
};

router.post("/render-pdf", async (req, res) => {
  const { documentHtml, fileName } = req.body ?? {};

  if (typeof documentHtml !== "string" || !documentHtml.includes("recap-print-area")) {
    res.status(400).json({ message: "Dokumen rekap untuk dicetak tidak valid." });
    return;
  }

  if (Buffer.byteLength(documentHtml, "utf8") > MAX_DOCUMENT_SIZE) {
    res.status(413).json({ message: "Dokumen rekap terlalu besar untuk dibuatkan PDF." });
    return;
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(existsSync(LOCAL_CHROME_PATH) ? { executablePath: LOCAL_CHROME_PATH } : {}),
      args: ["--disable-gpu", "--disable-software-rasterizer", "--no-sandbox"],
    });
    // Snapshot sudah membuang tag skrip. JavaScript tetap diaktifkan di konteks
    // ini karena Playwright memerlukannya untuk menerapkan style cetak.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(documentHtml, { waitUntil: "load", timeout: 45_000 });
    await page.emulateMedia({ media: "print" });
    await page.addStyleTag({ content: `
      .pdf-export {
        border: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        max-width: none !important;
        min-height: 0 !important;
        overflow: visible !important;
        padding: 0 !important;
        width: 100% !important;
      }
      .pdf-export .recap-table-scroll {
        overflow: visible !important;
      }
      .pdf-export table {
        table-layout: fixed !important;
        width: 100% !important;
      }
      .pdf-export table.min-w-\\[1200px\\],
      .pdf-export table.min-w-\\[297mm\\],
      .pdf-export table.min-w-\\[420mm\\] {
        min-width: 0 !important;
      }
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
