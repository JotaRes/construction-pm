import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function resourceTypeFor(mimetype: string): "image" | "video" | "raw" {
  if (!mimetype) return "raw";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  return "raw";
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export async function uploadToCloudinary(
  buffer: Buffer,
  options: { folder?: string; resourceType?: "image" | "video" | "raw"; filename?: string } = {}
): Promise<{ url: string; publicId: string }> {
  const folder = options.folder || process.env.CLOUDINARY_FOLDER || "financial-cfo";
  const resource_type = options.resourceType || "raw";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type,
        use_filename: true,
        unique_filename: true,
        filename_override: options.filename,
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error("upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function tryCloudinaryUpload(
  buffer: Buffer,
  options: { folder?: string; resourceType?: "image" | "video" | "raw"; filename?: string } = {}
): Promise<{ url: string; publicId: string } | null> {
  if (!isCloudinaryConfigured()) return null;
  try {
    return await uploadToCloudinary(buffer, options);
  } catch (e) {
    console.warn("[cloudinary] upload failed:", (e as Error).message);
    return null;
  }
}

export async function deleteFromCloudinary(publicId: string, resourceType: "image" | "video" | "raw" = "raw") {
  if (!isCloudinaryConfigured() || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.warn("[cloudinary] delete failed:", (e as Error).message);
  }
}
