// Cloudinary Image Upload Utility
const CLOUDINARY_CLOUD_NAME = 'dmpkquwhi';
const CLOUDINARY_UPLOAD_PRESET = 'notionupload';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Upload an image file or blob to Cloudinary
 * Returns the direct image URL on success
 */
export async function uploadToCloudinary(imageData: File | Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', imageData);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudinary upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (result.error) {
        throw new Error(`Cloudinary upload failed: ${result.error.message}`);
    }

    // Return the secure URL
    return result.secure_url;
}

/**
 * Extract image from clipboard data transfer
 * Returns the image blob if found, null otherwise
 */
export function getImageFromClipboard(dataTransfer: DataTransfer): File | null {
    const items = dataTransfer.items;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
            return item.getAsFile();
        }
    }

    return null;
}

/**
 * Check if clipboard contains an image
 */
export function hasClipboardImage(dataTransfer: DataTransfer): boolean {
    const items = dataTransfer.items;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
            return true;
        }
    }

    return false;
}

// Keep old function name for backwards compatibility
export const uploadToImgBB = uploadToCloudinary;
