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
    await page.emulateMediaType("print");

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
