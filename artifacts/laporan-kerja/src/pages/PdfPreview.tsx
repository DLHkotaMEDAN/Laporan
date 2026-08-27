import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { readPdfPreview, type StoredPdfPreview } from "@/utils/pdf-preview-storage";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PdfPreview = () => {
  const [params] = useSearchParams();
  const [preview, setPreview] = useState<StoredPdfPreview>();
  const [error, setError] = useState("");
  const pages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = params.get("id");
    if (!key) { setError("PDF tidak ditemukan."); return; }
    void readPdfPreview(key).then((value) => {
      if (value) setPreview(value); else setError("PDF sudah tidak tersedia. Kembali ke rekap dan buat PDF lagi.");
    }).catch(() => setError("PDF tidak dapat dibuka."));
  }, [params]);

  useEffect(() => {
    if (!preview || !pages.current) return;
    let cancelled = false;
    void (async () => {
      const documentPdf = await getDocument({ data: new Uint8Array(await preview.pdf.arrayBuffer()) }).promise;
      if (cancelled || !pages.current) return;
      pages.current.replaceChildren();
      for (let number = 1; number <= documentPdf.numPages; number += 1) {
        const page = await documentPdf.getPage(number);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) pages.current?.append(canvas);
      }
    })().catch(() => setError("Pratinjau PDF tidak dapat dirender."));
    return () => { cancelled = true; };
  }, [preview]);

  const share = async () => {
    if (!preview) return;
    const file = new File([preview.pdf], preview.fileName, { type: "application/pdf" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ files: [file], title: preview.fileName });
  };
  const download = () => {
    if (!preview) return;
    const link = document.createElement("a"); link.href = URL.createObjectURL(preview.pdf); link.download = preview.fileName; link.click(); URL.revokeObjectURL(link.href);
  };

  return <main className="min-h-screen bg-slate-200"><header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 bg-white px-3 shadow"><strong className="mr-auto truncate text-xs sm:text-base">{preview?.fileName || "Menyiapkan PDF…"}</strong><button onClick={() => void share()} className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Bagikan PDF</button><button onClick={download} className="rounded bg-slate-200 px-3 py-2 text-xs font-semibold">Unduh</button></header>{error ? <p className="p-8 text-center text-slate-600">{error}</p> : <div ref={pages} className="grid justify-items-center gap-4 p-2 sm:p-5"><p className="p-8 text-slate-600">Menampilkan pratinjau PDF…</p></div>}<style>{`.grid canvas{display:block;width:min(100%,1584px);height:auto;background:white;box-shadow:0 2px 14px #0f172a44}`}</style></main>;
};

export default PdfPreview;
