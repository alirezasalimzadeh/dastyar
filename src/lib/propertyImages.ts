import { supabase } from '@/lib/supabase';

export const PROPERTY_IMAGES_BUCKET = 'property-images';
export const MAX_PROPERTY_IMAGES = 10;
export const MAX_PROPERTY_IMAGE_SIZE = 8 * 1024 * 1024;
export const PROPERTY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const safeExtension = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return extension;
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
};

export interface FailedPropertyImageUpload {
  fileName: string;
  message: string;
}

export async function uploadPropertyImages(files: File[], propertyId: string, userId: string) {
  // Upload concurrently so a storage/network error does not make users wait once per image.
  const results = await Promise.all(files.map(async (file, index) => {
    const objectPath = `${userId}/${propertyId}/${Date.now()}-${index}-${crypto.randomUUID()}.${safeExtension(file)}`;
    const { error } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .upload(objectPath, file, { cacheControl: '3600', contentType: file.type, upsert: false });

    if (error) {
      return {
        url: null,
        path: null,
        failure: { fileName: file.name, message: error.message } satisfies FailedPropertyImageUpload,
      };
    }

    const { data } = supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(objectPath);
    return { url: data.publicUrl, path: objectPath, failure: null };
  }));

  return {
    urls: results.flatMap((result) => result.url ? [result.url] : []),
    objectPaths: results.flatMap((result) => result.path ? [result.path] : []),
    failedUploads: results.flatMap((result) => result.failure ? [result.failure] : []),
  };
}

export function propertyImageObjectPaths(urls: string[]) {
  const marker = `/storage/v1/object/public/${PROPERTY_IMAGES_BUCKET}/`;
  return urls.flatMap((url) => {
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return [];
    return [decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0])];
  });
}
