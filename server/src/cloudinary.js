const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer      - File buffer from multer memoryStorage
 * @param {object} options     - Cloudinary upload options (folder, resource_type, etc.)
 * @returns {Promise<{publicId: string, url: string, secureUrl: string}>}
 */
async function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve({
        publicId:  result.public_id,
        url:       result.url,
        secureUrl: result.secure_url,
        format:    result.format,
        bytes:     result.bytes,
      });
    });
    stream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by its public_id.
 * @param {string} publicId
 * @param {'image'|'raw'} resourceType
 */
async function deleteFile(publicId, resourceType = 'image') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { cloudinary, uploadBuffer, deleteFile };
