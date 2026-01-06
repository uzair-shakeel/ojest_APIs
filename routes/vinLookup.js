const express = require("express");
const router = express.Router();
const vinLookupController = require("../controllers/vinLookup");

// GET /api/vin-lookup?vin=...
router.get("/", vinLookupController.getCarDetailsByVin);

module.exports = router;
