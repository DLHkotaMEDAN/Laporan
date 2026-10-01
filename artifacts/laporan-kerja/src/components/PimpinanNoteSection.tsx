"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, MessageSquare, Save, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { isPimpinanAccess } from '@/constants/access-control';
import { cn } from "@/lib/utils";

interface PimpinanNoteSectionProps {
  initialNote?: string;
  onSave: (note: string) => Promise<void>;
}

const PimpinanNoteSection = ({ initialNote = "", onSave }: PimpinanNoteSectionProps) => {
  const { session, profile } = useAuth();
  const [note, setNote] = useState(initialNote);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isPimpinan = isPimpinanAccess(profile?.role, session?.user?.email);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(note);
      setIsEditing(false);
      showSuccess("Catatan pimpinan berhasil disimpan");
    } catch (error) {
      showError("Gagal menyimpan catatan");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isPimpinan && !initialNote) return null;

  return (
    <Card className={cn(
      "border-t-4 shadow-md no-print",
      isPimpinan ? "border-t-amber-500 bg-amber-50/30" : "border-t-blue-500 bg-blue-50/30"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPimpinan ? <ShieldCheck className="text-amber-600 h-5 w-5" /> : <MessageSquare className="text-blue-600 h-5 w-5" />}
            <span>{isPimpinan ? "Penilaian & Catatan Pimpinan" : "Catatan dari Pimpinan"}</span>
          </div>
          {isPimpinan && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-7 text-[10px] border-amber-200 text-amber-700 hover:bg-amber-100">
              {initialNote ? "Ubah Penilaian" : "Beri Penilaian"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea 
              value={note} 
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ketik evaluasi, kekurangan, atau instruksi perbaikan di sini..."
              className="min-h-[100px] bg-white border-amber-200 focus-visible:ring-amber-500"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setNote(initialNote); setIsEditing(false); }} disabled={isSaving}>Batal</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Penilaian
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              isPimpinan ? "bg-amber-100" : "bg-blue-100"
            )}>
              <AlertCircle className={cn("h-5 w-5", isPimpinan ? "text-amber-600" : "text-blue-600")} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-700 leading-relaxed italic">
                {initialNote || "Belum ada catatan atau penilaian dari pimpinan untuk laporan ini."}
              </p>
              {!isPimpinan && initialNote && (
                <p className="text-[10px] text-blue-600 font-bold mt-2 uppercase tracking-wider">
                  * Mohon segera tindak lanjuti instruksi di atas jika ada kesalahan.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PimpinanNoteSection;