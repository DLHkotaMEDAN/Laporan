import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Folder, User, FileText, Loader2, CloudUpload, FolderPlus, Check, X, Search, Copy, ExternalLink, Share2, ShieldAlert } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';
import { isPimpinanAccess } from '@/constants/access-control';

const CLIENT_ID = "323264526689-91gea696tm6ftv49jt4lb4tqjo5a1947.apps.googleusercontent.com"; 
const API_KEY = "AIzaSyDzRtvJVVWSYJ1e9VGKBhA1CxRYtlda1PY";
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

interface DriveUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (config: { fileName: string; folderId: string; accessToken: string }) => Promise<any>;
  defaultFileName: string;
}

const DriveUploadDialog = ({ isOpen, onClose, onUpload, defaultFileName }: DriveUploadDialogProps) => {
  const { session, profile } = useAuth();
  const [fileName, setFileName] = useState(defaultFileName);
  const [folderName, setFolderName] = useState("Drive Saya (Root)");
  const [folderId, setFolderId] = useState("root");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPickerApiLoaded, setIsPickerApiLoaded] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [uploadResult, setUploadResult] = useState<{ link: string; folderLink?: string; name: string } | null>(null);

  const isPimpinan = isPimpinanAccess(profile?.role, session?.user?.email);

  useEffect(() => {
    if (!isOpen) {
      setUploadResult(null);
      setIsPickerOpen(false);
      return;
    }

    if (!document.getElementById('google-gis')) {
      const script = document.createElement("script");
      script.id = 'google-gis';
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const loadGapi = () => {
      const gapi = (window as any).gapi;
      if (gapi) {
        gapi.load('picker', { callback: () => setIsPickerApiLoaded(true) });
      }
    };

    if (!document.getElementById('google-gapi')) {
      const gapiScript = document.createElement("script");
      gapiScript.id = 'google-gapi';
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.onload = loadGapi;
      document.body.appendChild(gapiScript);
    } else {
      loadGapi();
    }
  }, [isOpen]);

  const handleAuth = () => {
    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${response.access_token}`)
              .then(res => res.json())
              .then(data => setUserEmail(data.email || "Akun Terhubung"))
              .catch(() => setUserEmail("Akun Terhubung"));
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      showError("Gagal memulai autentikasi Google");
    }
  };

  const openPicker = () => {
    if (!accessToken) { showError("Silakan pilih akun terlebih dahulu"); return; }
    const google = (window as any).google;
    if (!isPickerApiLoaded || !google || !google.picker) { showError("Modul pemilih belum siap"); return; }

    try {
      setIsPickerOpen(true);
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setMimeTypes('application/vnd.google-apps.folder');

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(API_KEY)
        .setOrigin(window.location.origin)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            setFolderName(doc.name);
            setFolderId(doc.id);
            setIsPickerOpen(false);
          } else if (data.action === google.picker.Action.CANCEL) {
            setIsPickerOpen(false);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err: any) {
      setIsPickerOpen(false);
      showError(`Gagal membuka pemilih: ${err.message}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { showError("Nama folder kosong"); return; }
    setIsCreatingFolder(true);
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName, mimeType: 'application/vnd.google-apps.folder', parents: [folderId] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Gagal");
      setFolderName(data.name);
      setFolderId(data.id);
      setShowNewFolderInput(false);
      setNewFolderName("");
      showSuccess(`Folder "${data.name}" dibuat`);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFinalUpload = async () => {
    if (isPimpinan) {
      showError("Akun Pimpinan tidak diizinkan mengunggah file");
      return;
    }
    if (!accessToken) { showError("Akun belum terhubung"); return; }
    setIsUploading(true);
    try {
      const result = await onUpload({ fileName, folderId, accessToken });
      if (result && result.webViewLink) {
        setUploadResult({ link: result.webViewLink, folderLink: result.folderLink, name: fileName });
        showSuccess("Berhasil diunggah!");
      } else {
        onClose();
      }
    } catch (error) {
      showError("Gagal mengunggah");
    } finally {
      setIsUploading(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    showSuccess("Link disalin!");
  };

  return (
    <Dialog 
      open={isOpen} 
      modal={!isPickerOpen}
      onOpenChange={(open) => { 
        if (!open && !isUploading && !isCreatingFolder && !isPickerOpen) {
          onClose(); 
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-[450px]"
        onInteractOutside={(e) => {
          if (isPickerOpen || isUploading || isCreatingFolder) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          if (isPickerOpen) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CloudUpload className="text-blue-600 h-6 w-6" /> 
            {uploadResult ? "Berhasil Diunggah" : "Simpan ke Drive"}
          </DialogTitle>
          <DialogDescription>
            {uploadResult ? "File dan folder sekarang tersedia secara publik." : "Pilih akun Google dan tentukan lokasi penyimpanan."}
          </DialogDescription>
        </DialogHeader>

        {isPimpinan && !uploadResult && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-2 text-amber-800 text-xs">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <p>Mode Pantau: Tombol <strong>Mulai Unggah</strong> dinonaktifkan.</p>
          </div>
        )}

        {uploadResult ? (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-green-600 flex items-center gap-1"><FileText size={12} /> Link File PDF</Label>
                <div className="flex gap-2">
                  <Input readOnly value={uploadResult.link} className="bg-white border-green-200 text-xs h-9" />
                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 border-green-200 text-green-600" onClick={() => copyLink(uploadResult.link)}><Copy size={14} /></Button>
                </div>
              </div>
              
              {uploadResult.folderLink && (
                <div className="space-y-2 pt-2 border-t border-green-100">
                  <Label className="text-[10px] uppercase font-bold text-green-600 flex items-center gap-1"><Folder size={12} /> Link Folder Penyimpanan</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={uploadResult.folderLink} className="bg-white border-green-200 text-xs h-9" />
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 border-green-200 text-green-600" onClick={() => copyLink(uploadResult.folderLink!)}><Copy size={14} /></Button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-4">
              <Button variant="link" className="text-blue-600 text-xs" asChild><a href={uploadResult.link} target="_blank" rel="noreferrer"><ExternalLink size={14} className="mr-1" /> Buka File</a></Button>
              {uploadResult.folderLink && <Button variant="link" className="text-blue-600 text-xs" asChild><a href={uploadResult.folderLink} target="_blank" rel="noreferrer"><Share2 size={14} className="mr-1" /> Buka Folder</a></Button>}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Nama File PDF</Label>
              <div className="relative"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="pl-10 h-11" /></div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Akun Google</Label>
              <Button variant="outline" onClick={handleAuth} disabled={isUploading} className={cn("justify-start h-11 border-slate-200 relative px-10", userEmail ? "border-blue-200 bg-blue-50" : "")}><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />{userEmail ? <span className="text-blue-700 font-bold truncate">{userEmail}</span> : <span className="text-slate-500">Hubungkan Akun...</span>}</Button>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between"><Label className="text-xs font-bold uppercase text-slate-500">Lokasi Penyimpanan</Label>{accessToken && !showNewFolderInput && <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs font-bold" onClick={() => setShowNewFolderInput(true)}><FolderPlus size={14} className="mr-1" /> Tambah Folder</Button>}</div>
              {showNewFolderInput ? (
                <div className="flex gap-2 items-center p-2 bg-slate-50 rounded-lg border border-dashed border-blue-300"><Input placeholder="Nama folder baru..." className="h-9 text-sm bg-white" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus /><div className="flex gap-1"><Button size="icon" className="h-9 w-9 bg-green-600" onClick={handleCreateFolder} disabled={isCreatingFolder}>{isCreatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={18} />}</Button><Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400" onClick={() => setShowNewFolderInput(false)}><X size={18} /></Button></div></div>
              ) : (
                <div className="flex gap-2"><div className="flex-1 relative"><Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" /><div className="h-11 w-full border border-slate-200 rounded-md flex items-center pl-10 pr-3 text-sm bg-slate-50 text-slate-600 truncate">{folderName}</div></div><Button variant="secondary" onClick={openPicker} disabled={!accessToken || isUploading} className="h-11 px-4 bg-slate-200 text-slate-700 font-bold"><Search size={16} className="mr-2" /> Pilih</Button></div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {uploadResult ? (
            <Button onClick={onClose} className="w-full bg-slate-900">Selesai</Button>
          ) : (
            <div className="flex w-full gap-3">
              <Button variant="ghost" onClick={onClose} disabled={isUploading} className="flex-1">Batal</Button>
              <Button 
                onClick={handleFinalUpload} 
                disabled={isUploading || !accessToken || showNewFolderInput || isPimpinan} 
                className={cn("bg-blue-600 flex-[2] h-11 font-bold", isPimpinan && "opacity-50 cursor-not-allowed")}
              >
                {isUploading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Mengunggah...</> : "Mulai Unggah"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DriveUploadDialog;