const express = require("express");
const router = express.Router();
const { auth } = require("../middlewares/auth");
const imageDetectionController = require("../controllers/imageDetection");

/**
 * @route   POST /api/image-detection/detect
 * @desc    Detect image category using AI
 * @access  Private
 */
router.post("/detect", auth, imageDetectionController.detectImageCategory);

module.exports = router;
