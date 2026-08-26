/**
 * Mengompres dan meresize gambar sebelum diunggah
 * Target: Width 2.26" dan Height 2.95" dengan resolusi 150 PPI
 * 
 * UPDATE: Gambar ditarik (stretch) agar seluruh sisi dan timestamp terlihat
 */
export const compressImage = (
  base64: string, 
  targetWidthInches = 2.26, 
  targetHeightInches = 2.95, 
  quality = 0.9
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      // Konversi Inci ke Piksel (150 DPI/PPI)
      const PPI = 150;
      const width = Math.round(targetWidthInches * PPI);
      const height = Math.round(targetHeightInches * PPI);

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      // Gambar ditarik (stretch) untuk mengisi seluruh area canvas tanpa pemotongan (no crop)
      // Ini memastikan seluruh sisi gambar dan timestamp terlihat
      ctx.drawImage(img, 0, 0, width, height);

      // Ekspor sebagai JPG dengan kualitas 90%
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };
    
    img.onerror = () => {
      resolve(base64);
    };
  });
};