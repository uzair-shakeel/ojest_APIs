// backend/routes/webhook.js
const express = require("express");
const router = express.Router();

// Simple placeholder webhook endpoint (Clerk webhook removed)
router.post("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Webhook endpoint active (Clerk integration removed)",
  });
});

module.exports = router;
