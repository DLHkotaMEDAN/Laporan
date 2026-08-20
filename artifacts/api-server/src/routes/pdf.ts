import { Router } from "express";
import { chromium } from "playwright";

const router = Router();
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

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
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setContent(documentHtml, { waitUntil: "networkidle", timeout: 45_000 });
    await page.addStyleTag({ content: `
      @media print {
        table thead { display: table-header-group !important; }
        table tr { break-inside: avoid; page-break-inside: avoid; }
      }
    ` });
    await page.emulateMedia({ media: "print" });

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
