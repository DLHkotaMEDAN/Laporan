import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { auditLogService } from '@/services/auditLogService';

/**
 * Sanitasi nama file sebelum digunakan sebagai bagian dari path storage.
 * Menghapus path traversal (../, ./) dan karakter yang tidak aman,
 * menyisakan hanya alfanumerik, underscore, dan tanda hubung.
 */
const sanitizeFileName = (name: string): string => {
  // Ambil basename saja (hapus path separator apapun)
  const basename = name.replace(/[/\\]/g, '_');
  // Hapus karakter selain alfanumerik, underscore, tanda hubung, dan titik
  // Batasi panjang agar tidak menyebabkan path terlalu panjang
  return basename.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 100);
};

export const storageService = {
  async uploadPhoto(base64: string, fileName: string, userId: string): Promise<string> {
    // Deteksi MIME type dari prefix Base64 (format: data:image/xxx;base64,...)
    const mimeMatch = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = extMap[mimeType] ?? 'jpg';

    // Konversi Base64 ke Blob
    // Uint8Array.from langsung mengalokasikan buffer sekali — lebih efisien
    // daripada membuat intermediate Array lalu mengkonversinya ke TypedArray.
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteArray = Uint8Array.from(byteCharacters, (c) => c.charCodeAt(0));
    const blob = new Blob([byteArray], { type: mimeType });

    // Path menyertakan userId agar RLS Storage bisa validasi kepemilikan.
    // Format: {userId}/{timestamp}_{fileName}.{ext}
    const safeFileName = sanitizeFileName(fileName);
    const filePath = `${userId}/${Date.now()}_${safeFileName}.${ext}`;

    const { data, error } = await supabase.storage
      .from('report-photos')
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      logger.error("Error uploading to storage:", error);
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
      details: { bucket: 'report-photos', file_name: filePath, source_name: fileName, mime_type: mimeType, owner_id: userId },
    });
    return publicUrl;
  },

  async deletePhotoByUrl(url: string): Promise<void> {
    if (!url || !url.includes('report-photos')) return;

    try {
      // Ekstrak path lengkap setelah nama bucket dari URL
      // URL format: .../storage/v1/object/public/report-photos/subfolder/filename.jpg
      // filePath yang dibutuhkan: "subfolder/filename.jpg"
      const bucketMarker = '/report-photos/';
      const bucketIndex = url.indexOf(bucketMarker);
      const filePath = bucketIndex !== -1
        ? url.slice(bucketIndex + bucketMarker.length)
        : url.split('/').pop() ?? '';

      if (filePath) {
        const { error } = await supabase.storage
          .from('report-photos')
          .remove([filePath]);
        
        if (error) {
          logger.error("Gagal menghapus file dari storage:", error);
        } else {
          logger.info(`[storage] Berhasil menghapus foto lama: ${filePath}`);
          void auditLogService.logCurrentUser({
            action: 'DELETE',
            entityType: 'REPORT_PHOTO',
            entityId: filePath,
            details: { bucket: 'report-photos', file_name: filePath, mode: 'replace_or_cleanup' },
          });
        }
      }
    } catch (e) {
      logger.error("Error parsing URL untuk penghapusan:", e);
    }
  }
};
