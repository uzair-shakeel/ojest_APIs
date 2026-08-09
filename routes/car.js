// backend/routes/car.js
const express = require("express");
const { auth, admin, getAuth } = require("../middlewares/auth");
const router = express.Router();
const carController = require("../controllers/car");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

router.use((req, res, next) => {
  req.auth = getAuth(req);
  next();
});

// Public Routes
router.get("/search", carController.searchCars);
router.get("/recommended/:carId", carController.getRecommendedCars);

// Admin Routes — before /:carId
router.get("/admin/stats", auth, admin, carController.getCarStats);
router.get("/admin/all", auth, admin, carController.getAllCarsForAdmin);
router.patch("/admin/:carId/status", auth, admin, carController.updateCarStatusAdmin);
router.delete("/admin/:carId", auth, admin, carController.deleteCarAdmin);

router.get("/my-cars/all", auth, carController.getCarsByUserId);
router.get("/", carController.getAllCars);
router.get("/:carId", carController.getCarById);

router.post(
  "/upload-images",
  auth,
  upload.array("images", 20),
  uploadToCloudinary,
  carController.uploadImages
);

router.post(
  "/",
  auth,
  upload.array("images", 20),
  uploadToCloudinary,
  carController.addCar
);

router.put(
  "/:carId",
  auth,
  upload.array("images", 20),
  uploadToCloudinary,
  carController.updateCar
);
router.delete("/:carId", auth, carController.deleteCar);
router.put("/status/:carId", auth, admin, carController.updateCarStatus);

module.exports = router;
