type PdfPreviewOptions = {
  fileName: string;
};

const getSnapshot = () => {
  const printArea = document.querySelector<HTMLElement>(".recap-print-area");
  if (!printArea) throw new Error("Area rekap untuk PDF tidak ditemukan.");

  const head = document.head.cloneNode(false) as HTMLHeadElement;
  document.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet'][href]").forEach((link) => {
    const copy = link.cloneNode() as HTMLLinkElement;
    copy.href = new URL(link.getAttribute("href") || "", document.baseURI).href;
    head.append(copy);
  });
  document.querySelectorAll<HTMLStyleElement>("style").forEach((style) => {
    head.append(style.cloneNode(true));
  });

  const base = document.createElement("base");
  base.href = document.baseURI;
  head.prepend(base);

  const snapshot = printArea.cloneNode(true) as HTMLElement;
  snapshot.querySelectorAll("script, iframe").forEach((node) => node.remove());
  snapshot.querySelectorAll<HTMLLinkElement>("link[href]").forEach((link) => {
    link.href = new URL(link.getAttribute("href") || "", document.baseURI).href;
  });

  // Send only the actual report plus the styles it needs. This keeps the
  // request safely below mobile and serverless payload limits.
  return `<!doctype html><html><head>${head.innerHTML}</head><body>${snapshot.outerHTML}</body></html>`;
};

const showLoadingWindow = () => {
  const popup = window.open("", "_blank", "popup=yes,width=1100,height=800");
  if (!popup) return null;

  popup.document.write(`<!doctype html><title>Menyiapkan PDF</title><div style="font-family:system-ui,sans-serif;padding:2rem;color:#172033">Menyiapkan pratinjau PDF…</div>`);
  popup.document.close();
  return popup;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  "\"": "&quot;",
}[character] ?? character));

const showPdf = (popup: Window, pdf: Blob, fileName: string) => {
  const url = URL.createObjectURL(pdf);
  const safeName = escapeHtml(fileName);
  popup.document.write(`<!doctype html>
    <title>${safeName}</title>
    <style>
      * { box-sizing: border-box; } body { margin: 0; background: #e2e8f0; font-family: system-ui, sans-serif; }
      header { min-height: 56px; padding: 8px 16px; display: flex; align-items: center; gap: 8px; background: #fff; border-bottom: 1px solid #cbd5e1; }
      strong { margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      button, a { border: 0; border-radius: 7px; padding: 9px 13px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; }
      #share { color: #fff; background: #2563eb; } #download { color: #172033; background: #e2e8f0; }
      iframe { width: 100%; height: calc(100vh - 57px); border: 0; display: block; background: #fff; }
    </style>
    <header><strong>${safeName}</strong><button id="share" type="button">Bagikan PDF</button><a id="download" download="${safeName}">Unduh</a></header>
    <iframe title="Pratinjau PDF"></iframe>`);
  popup.document.close();

  const frame = popup.document.querySelector("iframe");
  const download = popup.document.querySelector<HTMLAnchorElement>("#download");
  frame?.setAttribute("src", url);
  if (download) download.href = url;

  popup.document.querySelector<HTMLButtonElement>("#share")?.addEventListener("click", async () => {
    const file = new File([pdf], fileName, { type: "application/pdf" });
    const data = { files: [file], title: fileName };
    if (typeof popup.navigator.share === "function" && (!popup.navigator.canShare || popup.navigator.canShare(data))) {
      try {
        await popup.navigator.share(data);
        return;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
      }
    }
    download?.click();
  });

  popup.addEventListener("beforeunload", () => URL.revokeObjectURL(url), { once: true });
};

export const openShareablePdfPreview = async ({ fileName }: PdfPreviewOptions) => {
  const popup = showLoadingWindow();
  if (!popup) throw new Error("Popup diblokir. Izinkan popup untuk menampilkan PDF.");

  try {
    const response = await fetch("/api/render-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentHtml: getSnapshot(), fileName }),
    });
    if (!response.ok) {
      if (response.status === 405 || response.status === 404) {
        throw new Error("Fitur PDF belum aktif di server online. Jalankan deploy ulang Vercel.");
      }
      const responseBody = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(responseBody?.message || "PDF tidak dapat dibuat.");
    }
    showPdf(popup, await response.blob(), fileName);
  } catch (error) {
    popup.close();
    throw error;
  }
};
