const express = require("express");
const router = express.Router();
const { clerkAuth } = require("../middlewares/clerkAuth");
const buyerRequestController = require("../controllers/buyerRequest");

// Debug route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Buyer request routes are working" });
});

// Debug route to get all buyer requests in the database
router.get("/debug/all", async (req, res) => {
  try {
    const { BuyerRequest } = require("../models");
    const requests = await BuyerRequest.find().sort({ createdAt: -1 });
    res.json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Debug route error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Debug route to check buyer requests for the authenticated user
router.get("/debug/user", clerkAuth, buyerRequestController.debugBuyerRequests);

// Create a new buyer request
router.post("/", clerkAuth, buyerRequestController.createBuyerRequest);

// Get all buyer requests (for sellers to browse)
router.get("/", buyerRequestController.getAllBuyerRequests);

// Get buyer requests by user ID (for buyer's dashboard)
router.get(
  "/my-requests",
  clerkAuth,
  buyerRequestController.getBuyerRequestsByUserId
);

// Get a single buyer request by ID
router.get("/:requestId", buyerRequestController.getBuyerRequestById);

// Update a buyer request
router.put("/:requestId", clerkAuth, buyerRequestController.updateBuyerRequest);

// Delete/cancel a buyer request
router.delete(
  "/:requestId",
  clerkAuth,
  buyerRequestController.deleteBuyerRequest
);

// Get offers for a specific buyer request
router.get(
  "/:requestId/offers",
  clerkAuth,
  buyerRequestController.getOffersForRequest
);

module.exports = router;
