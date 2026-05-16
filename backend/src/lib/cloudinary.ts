import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

/**
 * Pick the right Cloudinary resource_type from a MIME.
 * Cloudinary blocks PDF/ZIP delivery by default when stored as `image`
 * (Settings → Security → Restricted media types), so non-image files
 * must be uploaded as `raw` to be deliverable without dashboard tweaks.
 */
export function resourceTypeFor(mimetype?: string): 'image' | 'video' | 'raw' {
  if (!mimetype) return 'raw'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('video/')) return 'video'
  return 'raw'
}

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure HTTPS URL.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, use_filename: false, unique_filename: true },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'))
        resolve({ url: result.secure_url, publicId: result.public_id })
      },
    )
    stream.end(buffer)
  })
}

/**
 * Delete a file from Cloudinary by its public_id.
 * Silently ignores errors so a missing file never crashes a DELETE route.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'raw' })
    await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' })
  } catch (_) {
    // best-effort
  }
}

/**
 * Extract Cloudinary public_id from a secure URL.
 * e.g. https://res.cloudinary.com/mycloud/image/upload/v123/folder/abc123.pdf
 *   → "folder/abc123"
 */
export function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}
