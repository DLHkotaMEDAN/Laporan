import { NotaDinasSheet } from "@/components/nota-dinas/NotaDinasSheet";
import type { NotaDinasForm, NotaDinasTemplate } from "@/types/notaDinas";

type Props = {
  form: NotaDinasForm;
  sheetTemplate: NotaDinasTemplate;
  firstNumber: string;
  continuationNumber: string;
  displayHal: string;
  referenceNumber: string;
  requestDate: string;
  continuationDate: string;
  isRepair: boolean;
  isReadOnly: boolean;
};

export function NotaDinasPreview({
  form,
  sheetTemplate,
  firstNumber,
  continuationNumber,
  displayHal,
  referenceNumber,
  requestDate,
  continuationDate,
  isRepair,
  isReadOnly,
}: Props) {
  return (
    <>
      <div className={isReadOnly ? "xl:col-span-full nota-dinas-preview-wrap overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:p-6" : "nota-dinas-preview-wrap overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:p-6"}>
        <NotaDinasSheet
          kepada={form.kepada}
          dari={form.dari}
          nomor={firstNumber}
          tanggal={requestDate}
          hal={displayHal}
          wilayah={form.wilayah}
          jumlahKecamatan={form.jumlahKecamatan}
          kecamatan={form.kecamatan}
          penerima={form.penerima}
          koordinatorRujukan={form.koordinatorRujukan}
          referenceNumber={referenceNumber}
          referenceDate={requestDate}
          referenceHal={form.halRujukan || form.hal}
          isRepair={isRepair}
          platKendaraan={form.perbaikanPlatKendaraan}
          jenisKendaraan={form.perbaikanJenisKendaraan}
          supir={form.perbaikanSupir}
          noHp={form.perbaikanNoHp}
          uraianPemeriksaan={form.perbaikanUraianPemeriksaan}
          lokasiKejadian={form.perbaikanLokasi}
          kegiatanKejadian={form.perbaikanKegiatan}
          penutup={form.penutup}
          jabatanPenandatangan={form.jabatanPenandatangan}
          kantorPenandatangan={form.kantorPenandatangan}
          namaPenandatangan={form.namaPenandatangan}
          nipPenandatangan={form.nipPenandatangan}
          items={form.items}
          isLanjutan={false}
          showTitle
          templateParagrafPembuka={sheetTemplate.paragrafPembuka}
          templateParagrafSubJudul={sheetTemplate.paragrafSubJudul}
          templateParagrafPenutup={sheetTemplate.paragrafPenutup}
          templateParagrafPerbaikanPermintaan={sheetTemplate.paragrafPerbaikanPermintaan}
          templateParagrafPerbaikanLanjutan={sheetTemplate.paragrafPerbaikanLanjutan}
          templateParagrafLanjutanAlat={sheetTemplate.paragrafLanjutanAlat}
          templateParagrafKalimatPenutup={sheetTemplate.paragrafKalimatPenutup}
          kolomPerbaikan={sheetTemplate.kolomPerbaikan}
          kolomPermintaan={sheetTemplate.kolomPermintaan}
        />
        <NotaDinasSheet
          kepada={form.lanjutanKepada}
          dari={form.lanjutanDari}
          nomor={continuationNumber}
          tanggal={continuationDate}
          hal={displayHal}
          wilayah={form.wilayah}
          jumlahKecamatan={form.jumlahKecamatan}
          kecamatan={form.kecamatan}
          penerima={form.penerima}
          koordinatorRujukan={form.koordinatorRujukan}
          referenceNumber={referenceNumber}
          referenceDate={requestDate}
          referenceHal={displayHal}
          isRepair={isRepair}
          platKendaraan={form.perbaikanPlatKendaraan}
          jenisKendaraan={form.perbaikanJenisKendaraan}
          supir={form.perbaikanSupir}
          noHp={form.perbaikanNoHp}
          uraianPemeriksaan={form.perbaikanUraianPemeriksaan}
          lokasiKejadian={form.perbaikanLokasi}
          kegiatanKejadian={form.perbaikanKegiatan}
          penutup={form.lanjutanPenutup}
          jabatanPenandatangan={form.lanjutanJabatanPenandatangan}
          kantorPenandatangan={form.lanjutanKantorPenandatangan}
          namaPenandatangan={form.lanjutanNamaPenandatangan}
          nipPenandatangan={form.lanjutanNipPenandatangan}
          items={form.items}
          isLanjutan
          showTitle
          templateParagrafPembuka={sheetTemplate.paragrafPembuka}
          templateParagrafSubJudul={sheetTemplate.paragrafSubJudul}
          templateParagrafPenutup={sheetTemplate.paragrafPenutup}
          templateParagrafPerbaikanPermintaan={sheetTemplate.paragrafPerbaikanPermintaan}
          templateParagrafPerbaikanLanjutan={sheetTemplate.paragrafPerbaikanLanjutan}
          templateParagrafLanjutanAlat={sheetTemplate.paragrafLanjutanAlat}
          templateParagrafKalimatPenutup={sheetTemplate.paragrafKalimatPenutup}
          kolomPerbaikan={sheetTemplate.kolomPerbaikan}
          kolomPermintaan={sheetTemplate.kolomPermintaan}
        />
      </div>
      <style>{`
        .nota-dinas-sheet { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 20mm; font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.16; }
        .nota-dinas-sheet + .nota-dinas-sheet { margin-top: 24px; }
        .nota-dinas-title { margin: 0 0 18px; text-align: center; font-size: 15pt; font-weight: 400; text-decoration: underline; }
        .nota-dinas-repair-sheet .nota-dinas-title { font-size: 14pt; font-weight: 700; }
        .nota-dinas-meta { display: grid; gap: 0; margin-bottom: 18px; line-height: 1.05; }
        .nota-dinas-meta > div { display: grid; grid-template-columns: 23mm 4mm minmax(0, 1fr); align-items: start; column-gap: 0; }
        .nota-dinas-meta b { font-weight: 400; }
        .nota-dinas-meta > div > span:last-child { font-weight: 400; }
        .nota-dinas-rule { height: 6px; margin: 0 -0.5mm 12px; border-top: 4px double #111; }
        .nota-dinas-body { margin: 0 0 14px; text-align: justify; }
        .nota-dinas-numbered-paragraph { display: grid; grid-template-columns: 7mm minmax(0, 1fr); column-gap: 0; margin: 0 0 23px; text-align: justify; }
        .nota-dinas-numbered-paragraph > p { margin: 0; }
        .nota-dinas-request { margin: 0 0 14px 10mm; }
        .nota-dinas-driver { margin: 0 0 18px; }
        .nota-dinas-driver-row { display: grid; grid-template-columns: 21mm 4mm minmax(0, 1fr); }
        .nota-dinas-driver-row b { font-weight: 400; }
        .nota-dinas-table { width: 100%; border-collapse: collapse; margin-bottom: 23px; table-layout: fixed; }
        .nota-dinas-table th, .nota-dinas-table td { border: 1px solid #111; padding: 4px 7px; vertical-align: middle; }
        .nota-dinas-table th { height: 29px; font-size: 14pt; font-weight: 400; text-align: center; }
        .nota-dinas-table td { height: 22px; font-size: 11pt; }
        .nota-dinas-table th:nth-child(1), .nota-dinas-table td:nth-child(1) { width: 10%; text-align: center; }
        .nota-dinas-table th:nth-child(2), .nota-dinas-table td:nth-child(2) { width: 39%; }
        .nota-dinas-table th:nth-child(3), .nota-dinas-table td:nth-child(3) { width: 28%; }
        .nota-dinas-table th:nth-child(4), .nota-dinas-table td:nth-child(4) { width: 23%; }
        .nota-dinas-repair-paragraph { margin-bottom: 23px; text-indent: 12.7mm; }
        .nota-dinas-repair-sheet .nota-dinas-driver-row { grid-template-columns: 27.5mm 4mm minmax(0, 1fr); }
        .nota-dinas-repair-table { font-family: Calibri, Arial, sans-serif; }
        .nota-dinas-repair-table th:nth-child(1), .nota-dinas-repair-table td:nth-child(1) { width: 16.2%; text-align: center; }
        .nota-dinas-repair-table th:nth-child(2), .nota-dinas-repair-table td:nth-child(2) { width: 14.5%; text-align: center; }
        .nota-dinas-repair-table th:nth-child(3) { width: 69.3%; text-align: center; }
        .nota-dinas-repair-table td:nth-child(3) { width: 69.3%; text-align: left; }
        .nota-dinas-repair-table td.nota-dinas-repair-item { text-align: left; }
        .nota-dinas-repair-table th, .nota-dinas-repair-table td { box-sizing: border-box; font-size: 11pt; overflow-wrap: anywhere; word-break: normal; }
        .nota-dinas-repair-table th { font-weight: 700; }
        .nota-dinas-repair-table tr { break-inside: avoid; page-break-inside: avoid; }
        .nota-dinas-repair-table td { height: auto; min-height: 22px; line-height: 1.15; white-space: normal; }
        .nota-dinas-closing { margin-bottom: 24px; }
        .nota-dinas-final { margin: 0 0 0 14mm; }
        .nota-dinas-final-lanjutan { margin-left: 0; }
        .nota-dinas-signature { width: 68mm; margin: 79px 0 0 auto; display: flex; flex-direction: column; font-size: 12pt; line-height: 1.15; }
        .nota-dinas-signature-space { height: 132px; }
        .nota-dinas-underlined { text-decoration: underline; }
        @media screen and (max-width: 1279px) {
          .nota-dinas-preview-wrap { display: flex; flex-direction: column; align-items: center; }
          .nota-dinas-sheet { zoom: 0.72; }
          .nota-dinas-sheet + .nota-dinas-sheet { margin-top: 18px; }
        }
        @media screen and (max-width: 767px) {
          .nota-dinas-preview-wrap { padding: 8px; border-radius: 14px; }
          .nota-dinas-sheet { zoom: 0.43; box-shadow: 0 4px 14px rgb(15 23 42 / 0.18); }
          .nota-dinas-sheet + .nota-dinas-sheet { margin-top: 12px; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm !important; min-width: 210mm !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          body { overflow: visible !important; }
          header, .nota-dinas-main > :not(.nota-dinas-tabs) { display: none !important; }
          .nota-dinas-main { width: 210mm !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          .nota-dinas-tabs > div:first-child { display: none !important; }
          .nota-dinas-preview-wrap { position: absolute !important; inset: 0 auto auto 0 !important; display: block !important; width: 210mm !important; overflow: visible !important; padding: 0 !important; border: 0 !important; background: white !important; box-shadow: none !important; }
          .nota-dinas-sheet { zoom: 1 !important; width: 210mm !important; min-height: 297mm !important; margin: 0 !important; padding: 20mm !important; box-shadow: none !important; }
          .nota-dinas-sheet + .nota-dinas-sheet { break-before: page !important; page-break-before: always !important; }
        }
      `}</style>
    </>
  );
}
