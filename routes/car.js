// backend/routes/car.js
const express = require("express");
const { Car } = require("../models");
const { auth, getAuth } = require("../middlewares/auth");
const router = express.Router();
const carController = require("../controllers/car");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

// Middleware to attach auth data to req.auth
router.use((req, res, next) => {
  req.auth = getAuth(req);
  next();
});

// Public Routes
router.get("/search", carController.searchCars);
router.get("/recommended/:carId", carController.getRecommendedCars);
router.get("/", carController.getAllCars);
router.get("/:carId", carController.getCarById);

// @Admin Routes - NO AUTH REQUIRED FOR ADMIN PANEL
// Get car statistics for admin dashboard
router.get("/admin/stats", carController.getCarStats);
// Get all cars for admin with pagination and filtering
router.get("/admin/all", carController.getAllCarsForAdmin);
// Update car status (admin)
router.patch("/admin/:carId/status", carController.updateCarStatusAdmin);
// Delete car (admin only)
router.delete("/admin/:carId", carController.deleteCarAdmin);

// @Admin Routes - NO AUTH REQUIRED FOR ADMIN PANEL
// Get car statistics for admin dashboard
router.get("/admin/stats", carController.getCarStats);
// Get all cars for admin with pagination and filtering
router.get("/admin/all", carController.getAllCarsForAdmin);
// Update car status (admin)
router.patch("/admin/:carId/status", carController.updateCarStatusAdmin);
// Delete car (admin only)
router.delete("/admin/:carId", carController.deleteCarAdmin);

// Normal User Routes
router.post(
  "/",
  auth,
  upload.array("images", 10),
  uploadToCloudinary,
  carController.addCar
); // Max 10 images

router.get("/my-cars/all", auth, carController.getCarsByUserId);
router.put(
  "/:carId",
  auth,
  upload.array("images", 10),
  uploadToCloudinary,
  carController.updateCar
);
router.delete("/:carId", auth, carController.deleteCar);

// Admin Routes
router.put("/status/:carId", auth, carController.updateCarStatus);

module.exports = router;
