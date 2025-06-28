// backend/routes/car.js
const express = require("express");
const router = express.Router();
const carController = require("../controllers/car");
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

// Public Routes
router.get("/:carId", carController.getCarById);
router.get("/search", carController.searchCars);
router.get("/recommended/:carId", carController.getRecommendedCars);
router.get("/", carController.getAllCars);

// Normal User Routes
router.post(
  "/",
  clerkAuth,
  upload.array("images", 10),
  uploadToCloudinary,
  carController.addCar
); // Max 10 images

router.get("/my-cars/:userId", clerkAuth, carController.getCarsByUserId);
router.put(
  "/:carId",
  clerkAuth,
  upload.array("images", 10),
  uploadToCloudinary,
  carController.updateCar
);
router.delete("/:carId", clerkAuth, carController.deleteCar);

// Admin Routes
router.put("/status/:carId", clerkAuth, carController.updateCarStatus);

module.exports = router;
