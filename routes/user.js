// backend/routes/user.js
const express = require("express");
const { User } = require("../models");
const { auth, getAuth } = require("../middlewares/auth");
const router = express.Router();
const userController = require("../controllers/user");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

// Middleware to attach auth data to req.auth
router.use((req, res, next) => {
  req.auth = getAuth(req);
  next();
});

// @Public Routes (no authentication required)
// Get public user information (for car listings, etc.)
router.get("/public/:id", userController.getPublicUserInfo);

// @Protected Routes
// Get user profile by _id (requires authentication)
router.get("/:id", auth, userController.getUserById);

// @Protected Routes (requires authentication)
// Get all users (accessible only by admin)
router.get("/", userController.getAllUsers);

// @Admin Routes - NO AUTH REQUIRED FOR ADMIN PANEL
// Get user statistics for admin dashboard
router.get("/admin/stats", userController.getUserStats);
// Get all users for admin with pagination and filtering
router.get("/admin/all", userController.getAllUsersForAdmin);
// Toggle user block status
router.patch(
  "/admin/:targetUserId/toggle-block",
  userController.toggleUserBlock
);
// Change user role
router.patch("/admin/:targetUserId/role", userController.changeUserRole);
// Delete user (admin only)
router.delete("/admin/:targetUserId", userController.deleteUser);
// Approve user registration
router.patch("/admin/:targetUserId/approve", userController.approveUser);
// Reject user registration
router.patch("/admin/:targetUserId/reject", userController.rejectUser);
// Get user approval statistics
router.get("/admin/approval-stats", userController.getUserApprovalStats);

// SIMPLE APPROVAL UPDATE - NO AUTH REQUIRED (for testing)
router.patch(
  "/:userId/approval-status",
  userController.updateUserApprovalStatus
);

// Update user profile
router.put(
  "/profile",
  auth,
  upload.single("image"),
  uploadToCloudinary,
  userController.updateProfile
);
// after sign in page
router.put(
  "/profile/custom",
  auth,
  upload.single("image"),
  uploadToCloudinary,
  userController.updateProfileCustom
);
// Update seller type for a user
router.patch("/type/:id", auth, userController.updateSellerType);
// Delete user account
router.delete("/account", auth, userController.deleteAccount);

// --- Discovery Interactions ---
router.post("/like/:carId", auth, userController.likeCar);
router.post("/pass/:carId", auth, userController.passCar);
router.get("/wishlist/all", auth, userController.getLikedCars);
router.get("/discovery/interacted", auth, userController.getInteractedCars);
router.post("/discovery/reset", auth, userController.resetInteractions);

// Export routes
module.exports = router;
