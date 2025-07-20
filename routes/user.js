// backend/routes/user.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user");
const { clerkAuth, getAuth } = require("../middlewares/clerkAuth");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

// Middleware to attach auth data to req.auth
router.use((req, res, next) => {
  req.auth = getAuth(req);
  next();
});

// @Public Routes
// Get user profile by clerkUserId
router.get("/:id", userController.getUserById);

// @Protected Routes (requires authentication)
// Get all users (accessible only by admin)
router.get("/", userController.getAllUsers);
// Update user profile
router.put(
  "/profile",
  clerkAuth,
  upload.single("image"),
  uploadToCloudinary,
  userController.updateProfile
);
// after sign in page
router.put(
  "/profile/custom",
  clerkAuth,
  upload.single("image"),
  uploadToCloudinary,
  userController.updateProfileCustom
);
// Update seller type for a user
router.patch("/type/:id", clerkAuth, userController.updateSellerType);
// Delete user account
router.delete("/account", clerkAuth, userController.deleteAccount);
// Sync user from Clerk to MongoDB
// router.post('/sync-user', clerkAuth, userController.syncUser);
// Sync user route (public)
router.post("/sync-user", userController.syncUser);

// Export routes
module.exports = router;
