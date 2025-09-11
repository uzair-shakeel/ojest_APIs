const express = require("express");
const { auth } = require("../middlewares/auth");
const router = express.Router();
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
router.get("/debug/user", auth, buyerRequestController.debugBuyerRequests);

// Debug route to check all offers in the database
router.get("/debug/offers", async (req, res) => {
  try {
    const { SellerOffer } = require("../models");
    const offers = await SellerOffer.find()
      .populate("requestId", "title")
      .populate("sellerId", "firstName lastName");
    res.json({
      count: offers.length,
      offers: offers.map((o) => ({
        id: o._id,
        requestId: o.requestId,
        requestTitle: o.requestId?.title || "No title",
        sellerId: o.sellerId,
        sellerName: o.sellerId?.firstName || "Unknown",
        title: o.title,
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error("Debug offers route error:", error);
    res.status(500).json({ error: error.message });
  }
});

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
router.post("/", auth, buyerRequestController.createBuyerRequest);

// Get all buyer requests (for sellers to browse)
router.get("/", buyerRequestController.getAllBuyerRequests);

// Get buyer requests by user ID (for buyer's dashboard)
router.get(
  "/my-requests",
  auth,
  buyerRequestController.getBuyerRequestsByUserId
);

// Get offers for a specific buyer request (must come before :requestId)
router.get(
  "/:requestId/offers",
  auth,
  buyerRequestController.getOffersForRequest
);

// Get a single buyer request by ID
router.get("/:requestId", buyerRequestController.getBuyerRequestById);

// Update a buyer request
router.put("/:requestId", auth, buyerRequestController.updateBuyerRequest);

// Delete/cancel a buyer request
router.delete("/:requestId", auth, buyerRequestController.deleteBuyerRequest);

module.exports = router;
