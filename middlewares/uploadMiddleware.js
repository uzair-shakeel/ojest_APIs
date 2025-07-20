// backend/middlewares/uploadMiddleware.js
const multer = require("multer");
const cloudinary = require("../config/connect").cloudinary;
const streamifier = require("streamifier");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinary = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  let uploadCount = 0;
  req.files.forEach((file, idx) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "ojest_uploads" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res
            .status(500)
            .json({ error: "Cloudinary upload failed", details: error });
        }
        file.cloudinaryUrl = result.secure_url;
        console.log(`Cloudinary upload success [${idx}]:`, result.secure_url);
        uploadCount++;
        if (uploadCount === req.files.length) {
          next();
        }
      }
    );
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

module.exports = { upload, uploadToCloudinary };
