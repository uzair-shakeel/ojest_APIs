// backend/middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the 'uploads' directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Set storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Check file type
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Initialize upload
const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter,
});

module.exports = upload;