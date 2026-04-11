// backend/middlewares/uploadMiddleware.js
const multer = require("multer");
const cloudinary = require("../config/connect").cloudinary;
const streamifier = require("streamifier");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinary = async (req, res, next) => {
  // Handle the case where no files were uploaded at all
  if (!req.file && (!req.files || req.files.length === 0)) return next();

  const uploadSingle = (file, idx = 0) =>
    new Promise((resolve, reject) => {
      // Determine resource type and public ID options
      const isPdf = file.mimetype === "application/pdf";
      const resourceType = isPdf ? "raw" : "auto";

      const options = {
        folder: "ojest_uploads",

        resource_type: resourceType
      };

      // For raw files (PDFs), Cloudinary doesn't add extensions automatically.
      // We must AVOID the .pdf extension in the public_id to prevent 401 errors on this account.
      if (isPdf && file.originalname) {
        const nameWithoutExt = file.originalname.split('.').slice(0, -1).join('.');
        options.public_id = `${nameWithoutExt.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
      }

      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error);
          }
          console.log("🔍 [DEBUG] Cloudinary Upload Result:", {
            public_id: result.public_id,
            resource_type: result.resource_type,
            format: result.format,
            secure_url: result.secure_url
          });
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

