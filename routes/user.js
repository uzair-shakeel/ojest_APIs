// backend/routes/user.js
const express = require("express");
const { auth, admin, getAuth } = require("../middlewares/auth");
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

// @Public Routes
router.get("/public/:id", userController.getPublicUserInfo);

// @Admin Routes — MUST be before /:id so "admin" is not captured as an id
router.get("/admin/stats", auth, admin, userController.getUserStats);
router.get("/admin/all", auth, admin, userController.getAllUsersForAdmin);
router.get("/admin/approval-stats", auth, admin, userController.getUserApprovalStats);
router.patch(
  "/admin/:targetUserId/toggle-block",
  auth,
  admin,
  userController.toggleUserBlock
);
router.patch("/admin/:targetUserId/role", auth, admin, userController.changeUserRole);
router.delete("/admin/:targetUserId", auth, admin, userController.deleteUser);
router.patch("/admin/:targetUserId/approve", auth, admin, userController.approveUser);
router.patch("/admin/:targetUserId/reject", auth, admin, userController.rejectUser);

// Discovery (specific paths before /:id)
router.post("/like/:carId", auth, userController.likeCar);
router.post("/pass/:carId", auth, userController.passCar);
router.get("/wishlist/all", auth, userController.getLikedCars);
router.get("/discovery/interacted", auth, userController.getInteractedCars);
router.post("/discovery/reset", auth, userController.resetInteractions);

// @Protected Routes
router.get("/", auth, admin, userController.getAllUsers);
router.get("/:id", auth, userController.getUserById);

router.put(
  "/profile",
  auth,
  upload.single("image"),
  uploadToCloudinary,
  userController.updateProfile
);
router.put(
  "/profile/custom",
  auth,
  upload.single("image"),
  uploadToCloudinary,
  userController.updateProfileCustom
);
router.patch("/type/:id", auth, userController.updateSellerType);
router.delete("/account", auth, userController.deleteAccount);

// NOTE: unauthenticated /:userId/approval-status endpoint was removed (privilege escalation)

module.exports = router;
