/**
 * Lazy loading utilities for heavy libraries
 * These libraries are only loaded when needed (on-demand)
 * to reduce initial bundle size and improve performance
 */

// ExcelJS lazy loader
let exceljsModule: typeof import('exceljs') | null = null;

export const loadExcelJS = async () => {
  if (!exceljsModule) {
    exceljsModule = await import('exceljs');
  }
  return exceljsModule;
};

// jsPDF lazy loader
let jspdfModule: typeof import('jspdf') | null = null;

export const loadJsPDF = async () => {
  if (!jspdfModule) {
    jspdfModule = await import('jspdf');
  }
  return jspdfModule;
};

// PDF.js lazy loader
let pdfjsModule: typeof import('pdfjs-dist') | null = null;

export const loadPDFJS = async () => {
  if (!pdfjsModule) {
    pdfjsModule = await import('pdfjs-dist');
  }
  return pdfjsModule;
};
