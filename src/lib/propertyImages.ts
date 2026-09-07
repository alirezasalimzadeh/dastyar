export const MAX_PROPERTY_IMAGES = 10;
export const MAX_PROPERTY_IMAGE_SIZE = 8 * 1024 * 1024;
export const PROPERTY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface FailedPropertyImage {
  fileName: string;
  message: string;
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error('خواندن تصویر انجام نشد'));
  reader.readAsDataURL(blob);
});

/**
 * Compress an image in the browser and return a self-contained data URL.
 * This lets albums live in the existing properties.images column and removes
 * the need for a Supabase Storage bucket or any storage policies.
 */
const compressImage = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('فرمت تصویر قابل خواندن نیست'));
      element.src = objectUrl;
    });

    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('پردازش تصویر در مرورگر پشتیبانی نمی‌شود');
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('فشرده‌سازی تصویر انجام نشد')),
        'image/webp',
        0.72,
      );
    });
    return blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export async function preparePropertyImages(files: File[]) {
  const images: string[] = [];
  const failedImages: FailedPropertyImage[] = [];

  // Sequential processing keeps memory usage low on mobile devices.
  for (const file of files) {
    try {
      images.push(await compressImage(file));
    } catch (error) {
      failedImages.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    }
  }

  return { images, failedImages };
}
