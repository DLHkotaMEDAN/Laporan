import { ArrowRight, Leaf, LockKeyhole, MapPin, ShieldCheck, Sprout } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getStoredLandingPhotoUrl, type LandingPhotoSlot } from "@/services/landingPhotoService";

const leaders = [
  {
    role: "Wali Kota Medan",
    name: "Rico Tri Putra Bayu Waas",
    slot: "mayor" as LandingPhotoSlot,
    image: "https://upload.wikimedia.org/wikipedia/commons/9/97/WALIKOTA_MEDAN_-_RICO_WAAS.jpg",
  },
  {
    role: "Wakil Wali Kota Medan",
    name: "H. Zakiyuddin Harahap",
    slot: "deputyMayor" as LandingPhotoSlot,
    image: "https://dkp3.medan.go.id/storage/pimpinan/QEGV6dunjCjNh3hYJu3TMKDj2YjbHbnk9ptAbxRt.png",
  },
  {
    role: "Kepala Dinas Lingkungan Hidup",
    name: "Melvi Marlabayana, S.T., M.Si",
    slot: "environmentHead" as LandingPhotoSlot,
    image: "https://portal.medan.go.id/images/eselon/melvi-marlabayana-st-1_1756351561.jpg",
  },
];

const HERO_FALLBACK_IMAGE = "https://dlh.medan.go.id/web/resources/img/cover/780X520.jpg";

const PublicLanding = () => {
  const navigate = useNavigate();
  const [leaderPhotos, setLeaderPhotos] = useState<Record<LandingPhotoSlot, string>>({
    hero: HERO_FALLBACK_IMAGE,
    mayor: leaders[0].image,
    deputyMayor: leaders[1].image,
    environmentHead: leaders[2].image,
  });

  useEffect(() => {
    let active = true;
    void Promise.all([
      { slot: "hero" as LandingPhotoSlot, url: getStoredLandingPhotoUrl("hero") },
      ...leaders.map((leader) => ({ slot: leader.slot, url: getStoredLandingPhotoUrl(leader.slot) })),
    ].map(async ({ slot, url }) => ({ slot, url: await url }))).then((storedPhotos) => {
      if (!active) return;
      setLeaderPhotos((current) => {
        const next = { ...current };
        storedPhotos.forEach(({ slot, url }) => { if (url) next[slot] = url; });
        return next;
      });
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f8f4] text-slate-800">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/15 bg-[#075737]/90 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-8 md:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 text-[#e8d47a] sm:h-10 sm:w-10">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[9px] font-bold tracking-[0.12em] text-emerald-100 sm:text-xs sm:tracking-[0.16em]">PEMERINTAH KOTA MEDAN</p>
              <p className="truncate text-[13px] font-extrabold sm:text-base">Dinas Lingkungan Hidup</p>
            </div>
          </div>
          <Button onClick={() => navigate("/login")} className="h-9 shrink-0 rounded-full bg-[#f1d76d] px-3 font-bold text-[#12422f] shadow-lg hover:bg-[#ffe995] sm:h-10 sm:px-5">
            <LockKeyhole className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Login</span>
          </Button>
        </div>
      </header>

      <section className="relative isolate flex min-h-[610px] items-end overflow-hidden bg-[#075737] pt-20 sm:min-h-[590px] sm:pt-24 md:min-h-[620px]">
        <div className="absolute inset-0 scale-[1.42] bg-cover bg-center opacity-50 sm:scale-[1.35] sm:opacity-60 md:scale-[1.28]" style={{ backgroundImage: `url('${leaderPhotos.hero}')` }} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,57,36,.86)_0%,rgba(3,82,50,.78)_55%,rgba(2,57,36,.94)_100%)] md:bg-[linear-gradient(90deg,rgba(2,57,36,.95)_0%,rgba(4,92,56,.85)_43%,rgba(2,45,30,.42)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#075737] via-[#075737]/90 to-transparent sm:h-24 md:h-14" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#063d2a] via-[#063d2a]/90 to-transparent sm:h-36 md:h-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(236,211,105,.25),transparent_30%)]" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-12 sm:px-8 sm:pb-16 md:pb-24">
          <div className="max-w-3xl">
            <span className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#f1d76d]/50 bg-[#0a7146]/70 px-3 py-2 text-[11px] font-bold tracking-wide text-[#fff0a9] sm:mb-5 sm:px-4 sm:text-xs">
              <Sprout className="h-4 w-4" /> Pelestarian untuk Medan yang lebih hijau
            </span>
            <h1 className="max-w-2xl text-[2.15rem] font-black leading-[1.06] tracking-tight text-white sm:text-5xl md:text-6xl">Menjaga lingkungan, membangun masa depan Medan.</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-emerald-50 sm:mt-6 sm:text-lg">Portal Sistem Laporan Dinas Lingkungan Hidup Kota Medan. Akses pengelolaan laporan tersedia untuk petugas yang telah terdaftar.</p>
            <div className="mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
              <Button onClick={() => navigate("/login")} className="h-12 w-full rounded-full bg-[#f1d76d] px-6 font-bold text-[#12422f] hover:bg-[#ffe995] sm:w-auto">
                <span>Masuk ke Sistem</span><ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <a href="https://dlh.medan.go.id/web/" target="_blank" rel="noreferrer" className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/60 px-6 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:w-auto">
                Website DLH Kota Medan
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-7 md:-mt-7 md:px-8 md:py-8">
        {[
          [ShieldCheck, "Sistem Internal", "Data laporan hanya dapat diakses oleh pengguna berwenang."],
          [Leaf, "Lingkungan Berkelanjutan", "Mendorong layanan dan kerja lapangan yang lebih tertata."],
          [MapPin, "Kota Medan", "Dinas Lingkungan Hidup Pemerintah Kota Medan."],
        ].map(([Icon, title, description]) => {
          const FeatureIcon = Icon as typeof Leaf;
          return <div key={title as string} className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:block sm:min-h-44 sm:p-5 md:flex md:min-h-0"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 sm:mb-4 sm:h-11 sm:w-11 md:mb-0"><FeatureIcon className="h-5 w-5" /></div><div><h2 className="font-extrabold text-slate-800">{title as string}</h2><p className="mt-1 text-sm leading-relaxed text-slate-500">{description as string}</p></div></div>;
        })}
      </section>

      <section className="bg-white py-14 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10"><p className="font-bold tracking-[0.16em] text-emerald-700 text-[11px] sm:text-xs">PIMPINAN KOTA MEDAN</p><h2 className="mt-3 text-[1.8rem] font-black leading-tight tracking-tight text-slate-800 sm:text-4xl">Bersama mewujudkan Medan yang bersih dan lestari</h2></div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 md:gap-6">
            {leaders.map((leader) => <article key={leader.role} className="group w-[82vw] shrink-0 snap-center overflow-hidden rounded-3xl border border-slate-100 bg-[#f8fbf8] shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-auto sm:shrink"><div className="h-72 overflow-hidden bg-gradient-to-b from-emerald-100 to-emerald-50 sm:h-64 md:h-80"><img src={leaderPhotos[leader.slot]} alt={`Foto ${leader.name}`} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" /></div><div className="min-h-28 p-5 text-center sm:p-4 md:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700 md:text-xs md:tracking-[0.14em]">{leader.role}</p><h3 className="mt-2 text-lg font-extrabold leading-snug text-slate-800 md:text-xl">{leader.name}</h3></div></article>)}
          </div>
          <p className="mt-1 text-center text-xs text-slate-400 sm:hidden">Geser untuk melihat pimpinan lainnya</p>
        </div>
      </section>

      <footer className="bg-[#063d2a] px-5 py-8 text-center text-sm text-emerald-100"><p className="font-bold text-white">Dinas Lingkungan Hidup Kota Medan</p><p className="mt-1">Sistem Laporan Internal &middot; Pemerintah Kota Medan</p></footer>
    </main>
  );
};

export default PublicLanding;
