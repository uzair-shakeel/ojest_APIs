const express = require("express");
const { auth, admin } = require("../middlewares/auth");
const router = express.Router();
const sellerOfferController = require("../controllers/sellerOffer");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

// @Admin Routes
router.get("/admin/stats", auth, admin, sellerOfferController.getSellerOfferStats);
router.get("/admin/all", auth, admin, sellerOfferController.getAllSellerOffersForAdmin);
router.patch(
  "/admin/:offerId/status",
  auth,
  admin,
  sellerOfferController.updateSellerOfferStatusAdmin
);
router.delete("/admin/:offerId", auth, admin, sellerOfferController.deleteSellerOfferAdmin);

// Create a new seller offer
router.post(
  "/",
  auth,
  upload.array("files", 5),
  uploadToCloudinary,
  sellerOfferController.createSellerOffer
);

// Get all seller offers for a specific request
router.get("/request/:requestId", sellerOfferController.getOffersForRequest);

// Get available buyer requests for sellers
router.get(
  "/available-requests",
  auth,
  sellerOfferController.getAvailableBuyerRequests
);

// Get seller offers by seller ID (for seller's dashboard)
router.get("/my-offers", auth, sellerOfferController.getSellerOffersBySellerId);

// Get a single seller offer by ID (must come after specific routes)
router.get("/:offerId", sellerOfferController.getSellerOfferById);

// Update a seller offer
router.put("/:offerId", auth, sellerOfferController.updateSellerOffer);

// Delete/withdraw a seller offer
router.delete("/:offerId", auth, sellerOfferController.deleteSellerOffer);

module.exports = router;
