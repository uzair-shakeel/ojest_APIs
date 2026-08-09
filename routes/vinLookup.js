const express = require("express");
const router = express.Router();
const { auth } = require("../middlewares/auth");
const vinLookupController = require("../controllers/vinLookup");

// GET /api/vin-lookup?vin=...
router.get("/", auth, vinLookupController.getCarDetailsByVin);

module.exports = router;
