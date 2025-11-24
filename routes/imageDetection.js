const express = require("express");
const router = express.Router();
const imageDetectionController = require("../controllers/imageDetection");

/**
 * @route   POST /api/image-detection/detect
 * @desc    Detect image category using AI
 * @access  Public
 */
router.post("/detect", imageDetectionController.detectImageCategory);

module.exports = router;
