// Stay below Next's default 1 MB Server Action request limit, including multipart overhead.
export const MAX_EVENT_ARTWORK_BYTES = 900 * 1024

export const EVENT_ARTWORK_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

export function eventArtworkUploadError(file: { type: string; size: number }): string | null {
  if (!Object.hasOwn(EVENT_ARTWORK_EXTENSIONS, file.type)) return "Use a JPG, PNG, WebP, or GIF image."
  if (file.size > MAX_EVENT_ARTWORK_BYTES) {
    return "Use an image no larger than 900 KB. Export a 1200×600 JPG to reduce the file size."
  }
  if (!file.size) return "The image is empty. Please choose another file."
  return null
}
