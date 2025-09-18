// backend/middlewares/uploadMiddleware.js
const multer = require("multer");
const cloudinary = require("../config/connect").cloudinary;
const streamifier = require("streamifier");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinary = async (req, res, next) => {
  // Handle the case where no files were uploaded at all
  if (!req.file && (!req.files || req.files.length === 0)) return next();

  // Helper to upload a single in-memory file buffer to Cloudinary
  const uploadSingle = (file, idx = 0) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "ojest_uploads" },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error);
          }
          // Attach the Cloudinary URL to common properties used by controllers
          file.cloudinaryUrl = result.secure_url;
          // For downstream code expecting a "path" (disk storage style), map it to secure_url
          file.path = result.secure_url;
          console.log(`Cloudinary upload success [${idx}]:`, result.secure_url);
          resolve(result);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });

  try {
    if (req.file) {
      // Single file upload case (e.g., upload.single("image"))
      await uploadSingle(req.file, 0);
      return next();
    }

    if (req.files && req.files.length > 0) {
      // Multiple files upload case (e.g., upload.array(...))
      await Promise.all(req.files.map((f, i) => uploadSingle(f, i)));
      return next();
    }

    // Fallback
    return next();
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Cloudinary upload failed", details: err?.message || err });
  }
};

module.exports = { upload, uploadToCloudinary };

