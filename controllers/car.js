// backend/controllers/carController.js
const { Car, User } = require("../models");
const fs = require("fs");
const { Server } = require("socket.io");
let io; // Store io instance

// Function to set io instance (called from server.js)
exports.setIo = (socketIo) => {
  io = socketIo;
};
// Post a new car (Normal user)
exports.addCar = async (req, res) => {
  try {
    const { userId } = req.auth;
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    // if (!req.files || req.files.length === 0) {
    //   return res.status(400).json({ message: 'At least one image is required' });
    // }
    const {
      title,
      description,
      make,
      model,
      trim,
      type,
      year,
      color,
      condition,
      mileage,
      drivetrain,
      transmission,
      fuel,
      engine,
      horsepower,
      accidentHistory,
      serviceHistory,
      vin,
      country,
      carCondition,
      financialInfo,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !make ||
      !model ||
      !type ||
      !condition ||
      !financialInfo
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (
      !financialInfo.sellOptions ||
      !financialInfo.invoiceOptions ||
      !financialInfo.priceNetto
    ) {
      return res
        .status(400)
        .json({ message: "Missing required financial information" });
    }

    const images = req.files.map((file) => file.path);

    // Process financialInfo to handle possible comma-separated strings
    const processedFinancialInfo = {
      ...financialInfo,
      sellOptions: Array.isArray(financialInfo.sellOptions)
        ? financialInfo.sellOptions
        : String(financialInfo.sellOptions)
            .split(",")
            .map((option) => option.trim()),
      invoiceOptions: Array.isArray(financialInfo.invoiceOptions)
        ? financialInfo.invoiceOptions
        : String(financialInfo.invoiceOptions)
            .split(",")
            .map((option) => option.trim()),
      priceNetto: parseFloat(financialInfo.priceNetto),
    };

    const car = new Car({
      createdBy: userId,
      title,
      description,
      images,
      make,
      model,
      trim,
      type,
      year,
      color,
      condition,
      mileage,
      drivetrain,
      transmission,
      fuel,
      engine,
      horsepower,
      accidentHistory,
      serviceHistory,
      vin,
      country,
      carCondition: carCondition || {},
      financialInfo: {
        ...processedFinancialInfo,
        sellerType: user.sellerType, // Sync with user's sellerType
      },
      location: user.location,
      status: "Pending",
    });

    await car.save();
    res.status(201).json({ message: "Car posted successfully", car });
  } catch (error) {
    console.error("Add Car Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all cars posted by the user (Normal user)
exports.getCarsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const cars = await Car.find({ createdBy: userId });
    if (cars.length === 0) {
      return res.status(404).json({ message: "No cars found for this user" });
    }
    res.json(cars);
  } catch (error) {
    console.error("Get Cars By User ID Error:", error);
    res.status(500).json({
      message: "Error fetching cars for the user",
      error: error.message,
    });
  }
};

// Update a car (Normal user or Admin)
exports.updateCar = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { carId } = req.params;
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    if (car.createdBy !== userId && user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    if (user.blocked && user.role !== "admin") {
      return res.status(403).json({ message: "Account is blocked" });
    }

    const {
      title,
      description,
      make,
      model,
      trim,
      type,
      year,
      color,
      condition,
      mileage,
      drivetrain,
      transmission,
      fuel,
      engine,
      horsepower,
      accidentHistory,
      serviceHistory,
      vin,
      country,
      carCondition,
      financialInfo,
      location,
      status,
    } = req.body;

    const images =
      req.files && req.files.length > 0
        ? req.files.map((file) => file.path)
        : car.images;

    let coordinates = car.location.coordinates;
    if (location && location.coordinates) {
      if (typeof location.coordinates === "string") {
        try {
          coordinates = JSON.parse(location.coordinates);
        } catch (error) {
          return res
            .status(400)
            .json({ message: "Invalid location coordinates format" });
        }
      } else {
        coordinates = location.coordinates;
      }
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (images.length > 0) updateData.images = images;
    if (make) updateData.make = make;
    if (model) updateData.model = model;
    if (trim) updateData.trim = trim;
    if (type) updateData.type = type;
    if (year) updateData.year = year;
    if (color) updateData.color = color;
    if (condition) updateData.condition = condition;
    if (mileage) updateData.mileage = mileage;
    if (drivetrain) updateData.drivetrain = drivetrain;
    if (transmission) updateData.transmission = transmission;
    if (fuel) updateData.fuel = fuel;
    if (engine) updateData.engine = engine;
    if (horsepower) updateData.horsepower = horsepower;
    if (accidentHistory) updateData.accidentHistory = accidentHistory;
    if (serviceHistory) updateData.serviceHistory = serviceHistory;
    if (vin) updateData.vin = vin;
    if (country) updateData.country = country;
    if (carCondition) updateData.carCondition = carCondition;
    if (financialInfo) {
      // Process financialInfo to handle possible comma-separated strings
      const processedFinancialInfo = {
        ...financialInfo,
      };

      if (financialInfo.sellOptions) {
        processedFinancialInfo.sellOptions = Array.isArray(
          financialInfo.sellOptions
        )
          ? financialInfo.sellOptions
          : String(financialInfo.sellOptions)
              .split(",")
              .map((option) => option.trim());
      }

      if (financialInfo.invoiceOptions) {
        processedFinancialInfo.invoiceOptions = Array.isArray(
          financialInfo.invoiceOptions
        )
          ? financialInfo.invoiceOptions
          : String(financialInfo.invoiceOptions)
              .split(",")
              .map((option) => option.trim());
      }

      if (financialInfo.priceNetto) {
        processedFinancialInfo.priceNetto = parseFloat(
          financialInfo.priceNetto
        );
      }

      updateData.financialInfo = {
        ...car.financialInfo,
        ...processedFinancialInfo,
        sellerType: user.sellerType,
      };
    }
    if (coordinates) {
      updateData.location = {
        type: "Point",
        coordinates: [parseFloat(coordinates[0]), parseFloat(coordinates[1])],
      };
    }
    if (status && user.role === "admin") updateData.status = status;
    updateData.updatedAt = new Date();

    const updatedCar = await Car.findByIdAndUpdate(
      carId,
      { $set: updateData },
      { new: true }
    );

    // Emit car status update if status changed
    if (status && io) {
      io.emit("carStatusUpdate", { carId, status });
    }

    res.json({ message: "Car updated successfully", car: updatedCar });
  } catch (error) {
    console.error("Update Car Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a car (Normal user or Admin)
exports.deleteCar = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { carId } = req.params;
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    if (car.createdBy !== userId && user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    if (user.blocked && user.role !== "admin") {
      return res.status(403).json({ message: "Account is blocked" });
    }

    // Delete associated image files
    car.images.forEach((imagePath) => {
      fs.unlink(imagePath, (err) => {
        if (err) console.error(`Failed to delete image ${imagePath}:`, err);
      });
    });

    await Car.findByIdAndDelete(carId);
    res.json({ message: "Car and associated images deleted successfully" });
  } catch (error) {
    console.error("Delete Car Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all cars (Public)
exports.getAllCars = async (req, res) => {
  try {
    const cars = await Car.find().populate("createdBy", "firstName lastName");
    res.status(200).json(cars); // Returns an array of cars
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single car by ID (Public)
exports.getCarById = async (req, res) => {
  try {
    const { carId } = req.params;
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    res.json(car);
  } catch (error) {
    console.error("Get Car By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update car status (Admin only)
exports.updateCarStatus = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { carId } = req.params;
    const { status } = req.body;

    const user = await User.findOne({ clerkUserId: userId });
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    if (!status || !["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        message:
          "Invalid status value. Valid values are: Pending, Approved, Rejected.",
      });
    }

    const updatedCar = await Car.findByIdAndUpdate(
      carId,
      { status },
      { new: true }
    );
    if (!updatedCar) {
      return res.status(404).json({ message: "Car not found" });
    }
    res.json({ message: "Car status updated successfully", car: updatedCar });
  } catch (error) {
    console.error("Update Car Status Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Search cars with multiple query parameters (Public)
exports.searchCars = async (req, res) => {
  try {
    const {
      longitude,
      latitude,
      maxDistance = 10,
      make,
      model,
      type,
      trim,
      yearFrom,
      yearTo,
      condition,
      mileage,
      drivetrain,
      transmission,
      fuel,
      engine,
      serviceHistory,
      accidentHistory,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};

    // Location-based search (geospatial query)
    if (longitude && latitude) {
      const locationPoint = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
      query.location = {
        $nearSphere: {
          $geometry: locationPoint,
          $maxDistance: maxDistance * 1000,
        },
      };
    }

    // Search filters
    if (make) query.make = make;
    if (model) query.model = model;
    if (type) query.type = type;
    if (trim) query.trim = trim;
    if (condition) query.condition = condition;
    if (drivetrain) query.drivetrain = drivetrain;
    if (transmission) query.transmission = transmission;
    if (fuel) query.fuel = fuel;
    if (engine) query.engine = engine;
    if (serviceHistory) query.serviceHistory = serviceHistory;
    if (accidentHistory) query.accidentHistory = accidentHistory;

    // Year range filter
    if (yearFrom && yearTo) {
      query.year = { $gte: yearFrom, $lte: yearTo };
    }

    // Mileage filter
    if (mileage) {
      query.mileage = { $lte: mileage };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalCars = await Car.countDocuments(query);
    const cars = await Car.find(query).skip(skip).limit(limitNum);

    res.json({
      cars,
      total: totalCars,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCars / limitNum),
    });
  } catch (error) {
    console.error("Search Cars Error:", error);
    res
      .status(500)
      .json({ message: "Error searching cars", error: error.message });
  }
};

// Get recommended cars (Public)
exports.getRecommendedCars = async (req, res) => {
  try {
    const { carId } = req.params;
    const { priceRange = 5000 } = req.query;

    if (!carId) {
      return res.status(400).json({ message: "Car ID is required" });
    }

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    const { make, model, trim, financialInfo } = car;
    const priceNetto = financialInfo.priceNetto;

    let query = {
      _id: { $ne: carId }, // Exclude the current car
    };

    query.$or = [
      { make },
      { model },
      { trim },
      {
        "financialInfo.priceNetto": {
          $gte: priceNetto - parseFloat(priceRange),
          $lte: priceNetto + parseFloat(priceRange),
        },
      },
    ];

    const recommendedCars = await Car.find(query);
    if (recommendedCars.length === 0) {
      return res.status(404).json({ message: "No recommended cars found" });
    }

    res.json(recommendedCars);
  } catch (error) {
    console.error("Get Recommended Cars Error:", error);
    res.status(500).json({
      message: "Error fetching recommended cars",
      error: error.message,
    });
  }
};
