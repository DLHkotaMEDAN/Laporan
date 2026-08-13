import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const toPdfFile = (base64: string, fileName: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: 'application/pdf' });
};

const downloadFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const sharePdfFile = async (file: File) => {
  const shareData = { files: [file], title: file.name };
  const nativeShare = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
  const canUseNativeShare = typeof nativeShare === 'function' && (!navigator.canShare || navigator.canShare(shareData));

  if (canUseNativeShare) {
    try {
      await nativeShare(shareData);
      return 'shared' as const;
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return 'cancelled' as const;
    }
  }

  downloadFile(file);
  return 'downloaded' as const;
};

export const shareRecapPdfBase64 = (base64: string, fileName: string) =>
  sharePdfFile(toPdfFile(base64, fileName));

export const shareRecapElementAsPdf = async (element: HTMLElement, fileName: string) => {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    width: element.scrollWidth,
    windowWidth: element.scrollWidth,
    onclone: (documentClone) => {
      const printArea = documentClone.querySelector('.recap-print-area');
      if (!printArea) return;

      printArea.classList.add('recap-pdf-render');
      const printStyles = documentClone.createElement('style');
      printStyles.textContent = `
        .recap-pdf-render, .recap-pdf-render * {
          color: #000 !important;
          background-color: #fff !important;
          background-image: none !important;
          border-color: #000 !important;
          outline-color: #000 !important;
          text-decoration-color: #000 !important;
          box-shadow: none !important;
        }
        .recap-pdf-render thead, .recap-pdf-render th { background-color: #f1f5f9 !important; }
      `;
      documentClone.head.appendChild(printStyles);
    },
  });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  const pageImageHeight = (canvas.height * pageHeight) / imageHeight;

  for (let sourceY = 0, page = 0; sourceY < canvas.height; sourceY += pageImageHeight, page += 1) {
    const sliceHeight = Math.min(pageImageHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    pageCanvas.getContext('2d')?.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    if (page > 0) pdf.addPage('a3', 'landscape');
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, (sliceHeight * pageWidth) / canvas.width);
  }

  return sharePdfFile(new File([pdf.output('blob')], fileName, { type: 'application/pdf' }));
};
