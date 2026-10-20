import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SpjOli from "@/pages/SpjOli";
import PublicLanding from "./PublicLanding";
import { IndexAppHeader } from "@/components/index/IndexAppHeader";
import { IndexDialogs, type IndexConfirmDialogState } from "@/components/index/IndexDialogs";
import { IndexSummarySection } from "@/components/index/IndexSummarySection";
import { IndexWorkspaceTabs } from "@/components/index/IndexWorkspaceTabs";
import { useIndexPageController } from "@/hooks/useIndexPageController";
import { cn } from "@/lib/utils";

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from("assets").getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl("logo-medan.jpg");
const LOGO_DLH_URL = getLogoUrl("logo-dlh.jpg");
const DLH_HERO_IMAGE_URL = "https://dlh.medan.go.id/web/resources/img/cover/780X520.jpg";

const Index = () => {
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<IndexConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    variant: "danger",
    confirmLabel: "Ya, Lanjutkan",
    loading: false,
    onConfirm: async () => {},
  });
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isDailyRecapDateOpen, setIsDailyRecapDateOpen] = useState(false);
  const [dailyRecapDate, setDailyRecapDate] = useState(new Date().toISOString().split("T")[0]);
  const page = useIndexPageController({
    setConfirmDialog,
    onOpenDailyReportRecap: () => setIsDailyRecapDateOpen(true),
  });

  if (!page.authLoading && !page.isLoggedIn) return <PublicLanding />;

  if (page.authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Memverifikasi Hak Akses...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f7f2]">
      <IndexAppHeader
        logoMedanUrl={LOGO_MEDAN_URL}
        logoDlhUrl={LOGO_DLH_URL}
        isLoggedIn={page.isLoggedIn}
        isAdmin={page.access.isAdmin}
        username={page.profile?.username}
        email={page.session?.user?.email}
        role={page.profile?.role}
        onNavigate={page.navigate}
        onOpenTrash={() => setIsTrashOpen(true)}
        onOpenPasswordChange={() => setIsChangePasswordOpen(true)}
        onLogout={page.handleLogout}
      />

      <main className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", page.activeTab === "nota_dinas" && "nota-dinas-main")}>
        <IndexSummarySection
          isExecutive={page.access.showExecutiveHero}
          loginScopeLabel={page.access.loginScopeLabel}
          username={page.profile?.username}
          stats={page.stats}
          logoMedanUrl={LOGO_MEDAN_URL}
          logoDlhUrl={LOGO_DLH_URL}
          heroImageUrl={DLH_HERO_IMAGE_URL}
        />
        <IndexWorkspaceTabs {...page.workspaceProps} />
        {page.activeTab === "spj_oli"
          && (page.access.isAdmin || page.access.isPimpinan || page.access.isAdminSpj || page.access.isAdminSpjOli)
          && <div className="mt-6"><SpjOli recordCount={page.recordCounts.spj_oli} /></div>}
      </main>

      <IndexDialogs
        isTrashOpen={isTrashOpen}
        onTrashOpenChange={setIsTrashOpen}
        onRefresh={async () => { await page.loadData(); }}
        activeTab={page.activeTab}
        isChangePasswordOpen={isChangePasswordOpen}
        onPasswordChangeOpen={setIsChangePasswordOpen}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        isDailyRecapDateOpen={isDailyRecapDateOpen}
        onDailyRecapOpenChange={setIsDailyRecapDateOpen}
        dailyRecapDate={dailyRecapDate}
        onDailyRecapDateChange={setDailyRecapDate}
        onNavigate={page.navigate}
      />
    </div>
  );
};

export default Index;
