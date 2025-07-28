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

// @Admin Routes - NO AUTH REQUIRED FOR ADMIN PANEL
// Get buyer request statistics for admin dashboard
router.get("/admin/stats", buyerRequestController.getBuyerRequestStats);
// Get all buyer requests for admin with pagination and filtering
router.get("/admin/all", buyerRequestController.getAllBuyerRequestsForAdmin);
// Update buyer request status (admin)
router.patch(
  "/admin/:requestId/status",
  buyerRequestController.updateBuyerRequestStatusAdmin
);
// Delete buyer request (admin only)
router.delete(
  "/admin/:requestId",
  buyerRequestController.deleteBuyerRequestAdmin
);

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

module.exports = router;
