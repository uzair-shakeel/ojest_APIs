const express = require("express");
const { auth, admin } = require("../middlewares/auth");
const router = express.Router();
const buyerRequestController = require("../controllers/buyerRequest");

// Debug routes removed from public exposure (were dumping full DB)

// @Admin Routes
router.get("/admin/stats", auth, admin, buyerRequestController.getBuyerRequestStats);
router.get("/admin/all", auth, admin, buyerRequestController.getAllBuyerRequestsForAdmin);
router.patch(
  "/admin/:requestId/status",
  auth,
  admin,
  buyerRequestController.updateBuyerRequestStatusAdmin
);
router.delete(
  "/admin/:requestId",
  auth,
  admin,
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
