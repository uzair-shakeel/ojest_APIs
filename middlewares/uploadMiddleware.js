// backend/middlewares/uploadMiddleware.js
const multer = require("multer");
const cloudinary = require("../config/connect").cloudinary;
const streamifier = require("streamifier");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinary = (req, res, next) => {
  if (!req.file) return next();

  const stream = cloudinary.uploader.upload_stream(
    { folder: "ojest_uploads" },
    (error, result) => {
      if (error) {
        return res
          .status(500)
          .json({ error: "Cloudinary upload failed", details: error });
      }
      req.file.cloudinaryUrl = result.secure_url;
      next();
    }
  );
  streamifier.createReadStream(req.file.buffer).pipe(stream);
};

module.exports = { upload, uploadToCloudinary };
