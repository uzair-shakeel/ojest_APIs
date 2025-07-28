const express = require("express");
const router = express.Router();
const { clerkAuth } = require("../middlewares/clerkAuth");
const sellerOfferController = require("../controllers/sellerOffer");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

// @Admin Routes - NO AUTH REQUIRED FOR ADMIN PANEL
// Get seller offer statistics for admin dashboard
router.get("/admin/stats", sellerOfferController.getSellerOfferStats);
// Get all seller offers for admin with pagination and filtering
router.get("/admin/all", sellerOfferController.getAllSellerOffersForAdmin);
// Update seller offer status (admin)
router.patch(
  "/admin/:offerId/status",
  sellerOfferController.updateSellerOfferStatusAdmin
);
// Delete seller offer (admin only)
router.delete("/admin/:offerId", sellerOfferController.deleteSellerOfferAdmin);

// Create a new seller offer
router.post("/", clerkAuth, sellerOfferController.createSellerOffer);

// Get all seller offers for a specific request
router.get("/request/:requestId", sellerOfferController.getOffersForRequest);

// Get seller offers by seller ID (for seller's dashboard)
router.get(
  "/my-offers",
  clerkAuth,
  sellerOfferController.getSellerOffersBySellerId
);

// Get a single seller offer by ID
router.get("/:offerId", sellerOfferController.getSellerOfferById);

// Update a seller offer
router.put("/:offerId", clerkAuth, sellerOfferController.updateSellerOffer);

// Delete/withdraw a seller offer
router.delete("/:offerId", clerkAuth, sellerOfferController.deleteSellerOffer);

module.exports = router;
