import { supabase } from '@/lib/supabase';
import { auditLogService } from '@/services/auditLogService';

export const storageService = {
  async uploadPhoto(base64: string, fileName: string): Promise<string> {
    // Konversi Base64 ke Blob
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    const filePath = `${Date.now()}_${fileName}.jpg`;

    const { data, error } = await supabase.storage
      .from('report-photos')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error("Error uploading to storage:", error);
      throw error;
    }

    // Ambil Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('report-photos')
      .getPublicUrl(filePath);

    void auditLogService.logCurrentUser({
      action: 'CREATE',
      entityType: 'REPORT_PHOTO',
      entityId: filePath,
      details: { bucket: 'report-photos', file_name: filePath, source_name: fileName },
    });
    return publicUrl;
  },

  async deletePhotoByUrl(url: string): Promise<void> {
    if (!url || !url.includes('report-photos')) return;

    try {
      // Ekstrak nama file dari URL
      // URL format: .../storage/v1/object/public/report-photos/filename.jpg
      const parts = url.split('/');
      const fileName = parts[parts.length - 1];

      if (fileName) {
        const { error } = await supabase.storage
          .from('report-photos')
          .remove([fileName]);
        
        if (error) {
          console.error("Gagal menghapus file dari storage:", error);
        } else {
          console.log(`[storage] Berhasil menghapus foto lama: ${fileName}`);
          void auditLogService.logCurrentUser({
            action: 'DELETE',
            entityType: 'REPORT_PHOTO',
            entityId: fileName,
            details: { bucket: 'report-photos', file_name: fileName, mode: 'replace_or_cleanup' },
          });
        }
      }
    } catch (e) {
      console.error("Error parsing URL untuk penghapusan:", e);
    }
  }
};
