import React, { useCallback, useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressImage } from '@/utils/image-processor';

interface ImageUploadProps {
  value?: string;
  onChange: (base64: string) => void;
  label: string;
  disabled?: boolean;
  aspectClassName?: string;
  compressionSize?: { width: number; height: number };
}

const ImageUpload = ({ value, onChange, label, disabled = false, aspectClassName = "aspect-[2.26/2.95]", compressionSize = { width: 2.26, height: 2.95 } }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (disabled || !file.type.startsWith('image/')) return;
    
    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const originalBase64 = e.target?.result as string;
      const processedBase64 = await compressImage(originalBase64, compressionSize.width, compressionSize.height, 0.9);
      onChange(processedBase64);
      setIsProcessing(false);
    };
    
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [onChange, disabled]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    if (disabled) return;
    const item = e.clipboardData.items[0];
    if (item?.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) handleFile(file);
    }
  }, [onChange, disabled]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleAreaClick = () => {
    if (!isProcessing && !disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={`${label}: klik untuk memilih atau tempel gambar`}
        className={cn(
          "relative group rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden",
          aspectClassName,
          !disabled && "cursor-pointer",
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200",
          !disabled && !value && "hover:border-blue-400 hover:bg-slate-50",
          value ? "border-none" : "",
          disabled && "opacity-80 bg-slate-50 cursor-not-allowed"
        )}
        onClick={handleAreaClick}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            <p className="text-[10px] font-medium text-slate-500">Memproses...</p>
          </div>
        ) : value ? (
          <>
            <img src={value} alt={label} className="w-full h-full object-fill" />
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Ganti Foto</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(""); }}
                  aria-label={`Hapus ${label}`}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
          <textarea
            aria-label={`Tempel ${label}`}
            className="absolute inset-0 z-10 h-full w-full resize-none cursor-pointer rounded-xl bg-transparent text-transparent outline-none"
            onClick={(event) => { event.stopPropagation(); handleAreaClick(); }}
            onPaste={(event) => { event.stopPropagation(); onPaste(event); }}
            spellCheck={false}
          />
          <div className="pointer-events-none relative z-0 text-center p-4">
            <div className={cn(
              "mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors",
              disabled ? "bg-slate-200 text-slate-400" : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
            )}>
              <Upload size={20} />
            </div>
            <p className="text-xs font-medium text-slate-600">{disabled ? "Mode Pantau" : "Klik atau Paste"}</p>
            <p className="text-[10px] text-slate-400 mt-1">Klik, paste, atau tarik gambar ke sini</p>
          </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default ImageUpload;
