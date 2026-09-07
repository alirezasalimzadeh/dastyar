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

export async function uploadPropertyImages(files: File[], propertyId: string, userId: string) {
  const urls: string[] = [];
  const failedFiles: string[] = [];

  for (const [index, file] of files.entries()) {
    const objectPath = `${userId}/${propertyId}/${Date.now()}-${index}-${crypto.randomUUID()}.${safeExtension(file)}`;
    const { error } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .upload(objectPath, file, { cacheControl: '3600', contentType: file.type, upsert: false });

    if (error) {
      failedFiles.push(file.name);
      continue;
    }

    const { data } = supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(objectPath);
    urls.push(data.publicUrl);
  }

  return { urls, failedFiles };
}

export function propertyImageObjectPaths(urls: string[]) {
  const marker = `/storage/v1/object/public/${PROPERTY_IMAGES_BUCKET}/`;
  return urls.flatMap((url) => {
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return [];
    return [decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0])];
  });
}
