"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = void 0;
exports.uploadToCloudinary = uploadToCloudinary;
exports.deleteFromCloudinary = deleteFromCloudinary;
exports.extractPublicId = extractPublicId;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure HTTPS URL.
 */
async function uploadToCloudinary(buffer, folder, resourceType = 'auto') {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({ folder, resource_type: resourceType, use_filename: false, unique_filename: true }, (error, result) => {
            if (error || !result)
                return reject(error ?? new Error('Cloudinary upload failed'));
            resolve({ url: result.secure_url, publicId: result.public_id });
        });
        stream.end(buffer);
    });
}
/**
 * Delete a file from Cloudinary by its public_id.
 * Silently ignores errors so a missing file never crashes a DELETE route.
 */
async function deleteFromCloudinary(publicId) {
    try {
        await cloudinary_1.v2.uploader.destroy(publicId, { invalidate: true, resource_type: 'raw' });
        await cloudinary_1.v2.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
    }
    catch (_) {
        // best-effort
    }
}
/**
 * Extract Cloudinary public_id from a secure URL.
 * e.g. https://res.cloudinary.com/mycloud/image/upload/v123/folder/abc123.pdf
 *   → "folder/abc123"
 */
function extractPublicId(url) {
    try {
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        return match ? match[1] : null;
    }
    catch {
        return null;
    }
}
