const express = require("express");
const router = express.Router();
const listingGenerationController = require("../controllers/listingGeneration");
const { auth } = require("../middlewares/auth");

// POST /api/generate-listing
router.post("/", auth, listingGenerationController.generateListing);

module.exports = router;
