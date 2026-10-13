import type { NotaDinasItem, KolomTabel } from "@/types/notaDinas";
import { DEFAULT_KOLOM_PERBAIKAN, DEFAULT_KOLOM_PERMINTAAN } from "@/types/notaDinas";

export type NotaDinasSheetProps = {
  kepada: string;
  dari: string;
  nomor: string;
  tanggal: string;
  hal: string;
  wilayah: string;
  jumlahKecamatan: string;
  kecamatan: string;
  penerima: string;
  koordinatorRujukan: string;
  referenceNumber: string;
  referenceDate: string;
  referenceHal: string;
  isRepair: boolean;
  platKendaraan: string;
  jenisKendaraan: string;
  supir: string;
  noHp: string;
  uraianPemeriksaan: string;
  lokasiKejadian: string;
  kegiatanKejadian: string;
  penutup: string;
  jabatanPenandatangan: string;
  kantorPenandatangan: string;
  namaPenandatangan: string;
  nipPenandatangan: string;
  items: NotaDinasItem[];
  isLanjutan: boolean;
  showTitle: boolean;
  templateParagrafPembuka?: string;
  templateParagrafSubJudul?: string;
  templateParagrafPenutup?: string;
  templateParagrafPerbaikanPermintaan?: string;
  templateParagrafPerbaikanLanjutan?: string;
  templateParagrafLanjutanAlat?: string;
  templateParagrafKalimatPenutup?: string;
  kolomPerbaikan?: KolomTabel[] | null;
  kolomPermintaan?: KolomTabel[] | null;
};

const printValue = (value: string) => value.trim() || "......";

export const NotaDinasSheet = ({
  kepada, dari, nomor, tanggal, hal, wilayah, jumlahKecamatan, kecamatan, penerima,
  koordinatorRujukan, referenceNumber, referenceDate, referenceHal, isRepair,
  platKendaraan, jenisKendaraan, supir, noHp, uraianPemeriksaan, lokasiKejadian, kegiatanKejadian,
  penutup, jabatanPenandatangan,
  kantorPenandatangan, namaPenandatangan, nipPenandatangan, items, isLanjutan,
  showTitle,
  templateParagrafPembuka,
  templateParagrafSubJudul,
  templateParagrafPenutup,
  templateParagrafPerbaikanPermintaan,
  templateParagrafPerbaikanLanjutan,
  templateParagrafLanjutanAlat,
  templateParagrafKalimatPenutup,
  kolomPerbaikan,
  kolomPermintaan,
}: NotaDinasSheetProps) => {
  const activeKolom: KolomTabel[] = kolomPerbaikan && kolomPerbaikan.length > 0
    ? kolomPerbaikan
    : DEFAULT_KOLOM_PERBAIKAN;
  const activeKolomPermintaan: KolomTabel[] = kolomPermintaan && kolomPermintaan.length > 0
    ? kolomPermintaan
    : DEFAULT_KOLOM_PERMINTAAN;

  const placeholders: Record<string, string> = {
    wilayah, jumlahKecamatan, kecamatan,
    penerima: penerima || "",
    kepada,
    koordinatorRujukan,
    nomorRujukan: referenceNumber,
    tanggalRujukan: referenceDate,
    halRujukan: referenceHal,
    jenisKendaraan, platKendaraan,
    uraianPemeriksaan, lokasiKejadian, kegiatanKejadian,
  };
  const ph = (text: string) => Object.entries(placeholders).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v || "......"), text
  );

  const tPembuka = templateParagrafPembuka
    ?? `Sehubungan telah habisnya persediaan alat kerja di {wilayah}, Untuk {jumlahKecamatan} Kecamatan ({kecamatan}). Maka dibutuhkan penambahan alat kerja untuk kelancaran operasional di {wilayah}.`;
  const tSubJudul = templateParagrafSubJudul
    ?? `Adapun Permintaan Barang yang dibutuhkan sebagai berikut :`;
  const tPenutupPermintaan = templateParagrafPenutup
    ?? `Berkenaan dengan hal tersebut dimohon kepada {penerima} {kepada}, Agar kiranya memberikan Alat kerja tersebut.`;
  const tPerbaikanPermintaan = templateParagrafPerbaikanPermintaan
    ?? `Sehubungan untuk kelancaran pekerjaan operasional di {wilayah}, dengan ini kami melaporkan kerusakan kendaraan/Peralatan Mesin Kerja Nota Dinas Permintaan Perbaikan Kendaraan {jenisKendaraan} {platKendaraan} antara lain :`;
  const tPerbaikanLanjutan = templateParagrafPerbaikanLanjutan
    ?? `Menindaklanjuti surat dari {koordinatorRujukan} dengan Nomor : {nomorRujukan} Tanggal {tanggalRujukan}, Perihal {halRujukan}. Setelah dilakukan penelaahan dan pemeriksaan bahwa {uraianPemeriksaan}, pada saat kerja di {lokasiKejadian} ({kegiatanKejadian}).`;
  const tLanjutanAlat = templateParagrafLanjutanAlat
    ?? `Menindaklanjuti Surat dari {koordinatorRujukan} Nomor : {nomorRujukan} Tanggal {tanggalRujukan} Perihal {halRujukan}. Untuk Keperluan dan Kelancaran Kerja di Lapangan telah dilakukan Penelaahan dan Pemeriksaan bahwa telah Habisnya Alat Kerja tersebut.`;
  const tKalimatPenutup = penutup?.trim()
    ? penutup
    : (templateParagrafKalimatPenutup ?? "");

  return (
    <article className={`nota-dinas-sheet${isRepair ? " nota-dinas-repair-sheet" : ""} mx-auto bg-white text-black shadow-xl`}>
      {showTitle && <h1 className="nota-dinas-title">NOTA DINAS</h1>}

      <div className="nota-dinas-meta">
        <div><span>Yth</span><b>:</b><span>{printValue(kepada)}</span></div>
        <div><span>Dari</span><b>:</b><span>{printValue(dari)}</span></div>
        <div><span>Nomor</span><b>:</b><span>{printValue(nomor)}</span></div>
        <div><span>Tanggal</span><b>:</b><span>{printValue(tanggal)}</span></div>
        <div><span>Hal</span><b>:</b><span>{printValue(hal)}</span></div>
      </div>

      <div className="nota-dinas-rule" />

      {isRepair ? (isLanjutan ? <>
        <p className="nota-dinas-body nota-dinas-repair-paragraph">{ph(tPerbaikanLanjutan)}</p>
        <div className="nota-dinas-driver"><div className="nota-dinas-driver-row"><span>Supir</span><b>:</b><span>{printValue(supir)}</span></div><div className="nota-dinas-driver-row"><span>No. HP</span><b>:</b><span>{printValue(noHp)}</span></div></div>
      </> : <>
        <p className="nota-dinas-body nota-dinas-repair-paragraph">{ph(tPerbaikanPermintaan)}</p>
        <div className="nota-dinas-driver"><div className="nota-dinas-driver-row"><span>Supir</span><b>:</b><span>{printValue(supir)}</span></div><div className="nota-dinas-driver-row"><span>No. HP</span><b>:</b><span>{printValue(noHp)}</span></div></div>
      </>) : isLanjutan ? <>
        <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tLanjutanAlat)}</p>
        <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tSubJudul)}</p>
      </> : <>
        <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tPembuka)}</p>
        <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tSubJudul)}</p>
      </>}

      {isRepair ? (() => {
        const rowspanKolom = activeKolom.filter((k) => k.rowspan);
        const nonRowspanKolom = activeKolom.filter((k) => !k.rowspan);
        const displayItems = items.length > 0 ? items : [{ jenis: "", jumlah: "", satuan: "", keterangan: "" }];
        const rowspanValues: Record<string, string> = {};
        rowspanKolom.forEach((k) => {
          if (k.id === "plat") rowspanValues[k.id] = platKendaraan;
          else if (k.id === "jenis") rowspanValues[k.id] = jenisKendaraan;
          else rowspanValues[k.id] = displayItems[0]?.[k.id] || "";
        });
        return (
          <table className="nota-dinas-table nota-dinas-repair-table">
            <thead>
              <tr>
                {activeKolom.map((k) => (
                  <th key={k.id} style={{ width: `${k.lebar}%` }}>{k.judul}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, index) => (
                <tr key={index}>
                  {rowspanKolom.map((k) =>
                    index === 0 ? (
                      <td key={k.id} rowSpan={displayItems.length}>
                        {printValue(rowspanValues[k.id] || "")}
                      </td>
                    ) : null
                  )}
                  {nonRowspanKolom.map((k) => (
                    <td key={k.id} className="nota-dinas-repair-item">
                      {k.id === "perbaikan" ? printValue(item.jenis) : printValue(item[k.id] || "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })() : (() => {
        const displayItems = items.length > 0 ? items : [{ jenis: "", jumlah: "", satuan: "", keterangan: "" }];
        return (
          <table className="nota-dinas-table">
            <thead>
              <tr>
                {activeKolomPermintaan.map((k) => (
                  <th key={k.id} style={{ width: `${k.lebar}%` }}>{k.judul}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, index) => (
                <tr key={index}>
                  {activeKolomPermintaan.map((k) => {
                    if (k.id === "nomor") return <td key={k.id}>{index + 1}.</td>;
                    if (k.id === "jumlah") return <td key={k.id}>{printValue(`${item.jumlah || ""}${item.satuan ? ` ${item.satuan}` : ""}`)}</td>;
                    return <td key={k.id}>{printValue((item[k.id] as string) || "")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })()}

      {!isLanjutan && !isRepair && <p style={{ margin: "0 0 24px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tPenutupPermintaan)}</p>}
      {isRepair
        ? <p className="nota-dinas-body nota-dinas-repair-paragraph nota-dinas-closing">{ph(tKalimatPenutup)}</p>
        : <p style={{ margin: "0 0 24px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tKalimatPenutup)}</p>
      }

      <div className="nota-dinas-signature">
        <span>{printValue(jabatanPenandatangan)}</span>
        <span>{printValue(kantorPenandatangan)}</span>
        <div className="nota-dinas-signature-space" />
        <span className="nota-dinas-underlined">{printValue(namaPenandatangan)}</span>
        <span>NIP {printValue(nipPenandatangan)}</span>
      </div>
    </article>
  );
};
