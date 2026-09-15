const MAX_DOCUMENT_SIZE = 4 * 1024 * 1024;

type RequestLike = {
  method?: string;
  body?: { documentHtml?: unknown; fileName?: unknown };
};

type ResponseLike = {
  status: (status: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: unknown) => void;
};

const safeFileName = (value: unknown) => {
  const name = typeof value === "string" ? value : "rekap";
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return `${sanitized.replace(/\.pdf$/i, "") || "rekap"}.pdf`;
};

const errorResponse = (response: ResponseLike, message: string, status = 500) => {
  response.setHeader("Cache-Control", "no-store");
  response.status(status).json({ message });
};

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== "POST") {
    errorResponse(response, "Metode tidak didukung.", 405);
    return;
  }

  const { documentHtml, fileName } = request.body ?? {};

  if (typeof documentHtml !== "string" || !documentHtml.includes("recap-print-area")) {
    errorResponse(response, "Dokumen rekap untuk dicetak tidak valid.", 400);
    return;
  }
  // JavaScript strings use at most two bytes per code unit. This conservative
  // check stays below the Vercel request body limit without DOM-only APIs.
  if (documentHtml.length * 2 > MAX_DOCUMENT_SIZE) {
    errorResponse(response, "Rekap terlalu besar untuk dibuatkan PDF.", 413);
    return;
  }

  let browser: import("puppeteer-core").Browser | undefined;
  try {
    // Load these server-only modules only when this endpoint is requested.
    // This prevents the whole Vercel Function from failing before it can
    // return a useful response if Chromium cannot be initialized.
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);

    chromium.setGraphicsMode = false;
    browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(documentHtml, { waitUntil: "load", timeout: 40_000 });
    // Enforce repeated column headers in Chromium. Some captured recap styles
    // can otherwise cause <thead> to be treated like a regular table row.
    await page.emulateMediaType("print");
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
    .pdf-export table,
    .pdf-export th,
    .pdf-export td {
      box-sizing: border-box !important;
      min-width: 0 !important;
      max-width: 100% !important;
      overflow-wrap: anywhere !important;
    }
    @page { size: A3 landscape; margin: 10mm; }
    html, body { margin: 0 !important; padding: 0 !important; }
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

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="${safeFileName(fileName)}"`);
    response.setHeader("Cache-Control", "no-store");
    response.status(200).end(pdf);
  } catch {
    errorResponse(response, "Mesin pembuat PDF tidak tersedia. Coba lagi beberapa saat.");
  } finally {
    await browser?.close();
  }
}
