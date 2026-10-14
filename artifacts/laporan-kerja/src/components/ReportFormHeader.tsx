import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Copy, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ReportFormHeaderProps {
  isEditing: boolean;
  isDuplicateMode: boolean;
  isSubmitting: boolean;
  isPimpinan: boolean;
  uploadProgress: string;
  lastSavedAt: string | null;
  onBack: () => void;
  onDuplicate: () => void;
}

const ReportFormHeader = ({
  isEditing,
  isDuplicateMode,
  isSubmitting,
  isPimpinan,
  uploadProgress,
  lastSavedAt,
  onBack,
  onDuplicate,
}: ReportFormHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <Button type="button" variant="ghost" onClick={onBack} className="px-2 md:px-4">
        <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
      </Button>
      <div className="flex flex-col items-center">
        <h1 className="text-lg md:text-2xl font-bold text-primary">
          {isEditing && !isDuplicateMode ? "Edit Laporan" : "Input Laporan Baru"}
        </h1>
        {isDuplicateMode && (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 mt-1 animate-pulse">
            <Copy size={10} className="mr-1" /> Mode Duplikat: Belum Tersimpan
          </Badge>
        )}
        <p className="text-[10px] text-slate-500 mt-1">
          {lastSavedAt ? "Draft tersimpan" : "Draft akan tersimpan otomatis"}
        </p>
      </div>
      <div className="flex gap-2">
        {isEditing && !isDuplicateMode && (
          <Button
            type="button"
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50 px-2 md:px-4"
            onClick={onDuplicate}
          >
            <Copy className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Duplikat</span>
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || isPimpinan}
          className={cn("bg-blue-600 hover:bg-blue-700 px-2 md:px-8", isPimpinan && "opacity-50 cursor-not-allowed")}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin md:mr-2" />{" "}
              <span className="hidden md:inline">{uploadProgress || "Menyimpan..."}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 md:mr-2" />{" "}
              <span className="hidden md:inline">
                {isDuplicateMode ? "Simpan Sebagai Baru" : "Simpan Laporan"}
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ReportFormHeader;
