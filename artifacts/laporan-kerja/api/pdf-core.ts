/**
 * Shared PDF rendering constants and helpers — Vercel adapter copy.
 *
 * Karena laporan-kerja/api dan api-server adalah dua artifact terpisah
 * dengan node_modules masing-masing, file ini merupakan salinan dari
 * artifacts/api-server/src/lib/pdf-core.ts.
 *
 * Jika ada perubahan logika/style, update KEDUA file secara bersamaan.
 */

// Vercel serverless memiliki batas memori lebih ketat — pakai limit 4 MB
export const MAX_DOCUMENT_SIZE = 4 * 1024 * 1024;

export const safeFileName = (value: unknown): string => {
  const name = typeof value === "string" ? value : "rekap";
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return `${sanitized.replace(/\.pdf$/i, "") || "rekap"}.pdf`;
};

export const validatePdfPayload = (
  documentHtml: unknown,
  maxBytes = MAX_DOCUMENT_SIZE,
): string | null => {
  if (typeof documentHtml !== "string" || !documentHtml.includes("recap-print-area")) {
    return "Dokumen rekap untuk dicetak tidak valid.";
  }
  if (new TextEncoder().encode(documentHtml).byteLength > maxBytes) {
    return "Dokumen rekap terlalu besar untuk dibuatkan PDF.";
  }
  return null;
};

export const PDF_PRINT_STYLES = `
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
  .pdf-export table.min-w-\\[1200px\\],
  .pdf-export table.min-w-\\[297mm\\],
  .pdf-export table.min-w-\\[420mm\\] {
    min-width: 0 !important;
  }
  @page { size: A3 landscape; margin: 10mm; }
  html, body { margin: 0 !important; padding: 0 !important; }
  @media print {
    table:not(.continuation-table) thead { display: table-header-group !important; }
    table.continuation-table thead { display: none !important; }
    table tr { break-inside: avoid; page-break-inside: avoid; }
  }
`;

export const PDF_THEAD_SCRIPT =
  "document.querySelectorAll('table:not(.continuation-table) thead')" +
  ".forEach((header) => header.style.setProperty('display', 'table-header-group', 'important'))";

export const PDF_PAGE_OPTIONS = {
  format: "A3" as const,
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
};
