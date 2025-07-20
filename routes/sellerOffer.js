const express = require("express");
const router = express.Router();
const { clerkAuth } = require("../middlewares/clerkAuth");
const sellerOfferController = require("../controllers/sellerOffer");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

// Debug route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Seller offer routes are working" });
});

// Debug route to check seller offers for the authenticated user
router.get("/debug", clerkAuth, sellerOfferController.debugSellerOffers);

// Create a new offer for a buyer request
router.post(
  "/:requestId",
  clerkAuth,
  upload.array("files", 5),
  uploadToCloudinary,
  sellerOfferController.createOffer
);

// Get all offers made by a seller
router.get("/my-offers", clerkAuth, sellerOfferController.getSellerOffers);

// Get available buyer requests for sellers
router.get(
  "/available-requests",
  clerkAuth,
  sellerOfferController.getAvailableBuyerRequests
);

// Get a single offer by ID
router.get("/:offerId", sellerOfferController.getOfferById);

// Update an offer
router.put(
  "/:offerId",
  clerkAuth,
  upload.array("files", 5),
  uploadToCloudinary,
  sellerOfferController.updateOffer
);

// Delete/cancel an offer
router.delete("/:offerId", clerkAuth, sellerOfferController.deleteOffer);

// Accept an offer (buyer only)
router.post("/:offerId/accept", clerkAuth, sellerOfferController.acceptOffer);

// Reject an offer (buyer only)
router.post("/:offerId/reject", clerkAuth, sellerOfferController.rejectOffer);

module.exports = router;
