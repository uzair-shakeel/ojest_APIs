// backend/controllers/carController.js
const { Car, User } = require("../models");
const fs = require("fs");
const { Server } = require("socket.io");
let io; // Store io instance

// Function to set io instance (called from server.js)
exports.setIo = (socketIo) => {
  io = socketIo;
};

const COUNTRY_MAPPING = {
  "Albania": [],
  "Armenia": [],
  "Australia": [],
  "Austria": [],
  "Azerbejdżan": [],
  "Bahrajn": [],
  "Belgia": [],
  "Białoruś": [],
  "Bułgaria": [],
  "Chiny": [
    "BAIC", "Brilliance", "BYD", "Changan", "Chery", "Dongfeng", "Geely",
    "Great Wall Motors", "Haval", "JAC Motors", "JMC", "Lifan", "Nio",
    "Polestar", "Volvo", "Wuling", "Zotye", "MG"
  ],
  "Chorwacja": [],
  "Czarnogóra": [],
  "Czechy": ["Škoda"],
  "Dania": [],
  "Dubaj": [],
  "Estonia": [],
  "Finlandia": [],
  "Francja": ["Alpine", "Bugatti", "Citroën", "DS", "Peugeot", "Renault"],
  "Gruzja": [],
  "Hiszpania": ["Seat"],
  "Holandia": [],
  "Indie": ["Mahindra", "Tata Motors"],
  "Irlandia": [],
  "Islandia": [],
  "Izrael": [],
  "Japonia": [
    "Acura", "Daihatsu", "Honda", "Infiniti", "Isuzu", "Lexus", "Mazda",
    "Mitsubishi", "Nissan", "Subaru", "Suzuki", "Toyota"
  ],
  "Kanada": [],
  "Katar": [],
  "Kazachstan": [],
  "Korea Południowa": ["Daewoo", "Genesis", "Hyundai", "Kia", "SsangYong"],
  "Kuwejt": [],
  "Litwa": [],
  "Luksemburg": [],
  "Łotwa": [],
  "Macedonia Północna": [],
  "Malezja": ["Proton"],
  "Niemcy": [
    "Audi", "BMW", "Maybach", "Mercedes-Benz", "Opel", "Porsche", "Smart", "Volkswagen"
  ],
  "Norwegia": [],
  "Oman": [],
  "Portugalia": [],
  "Rosja": ["Lada"],
  "Rumunia": ["Dacia"],
  "Arabia Saudyjska": [],
  "Serbia": [],
  "Słowacja": [],
  "Słowenia": [],
  "Stany Zjednoczone": [
    "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Fisker", "Ford",
    "GMC", "Hummer", "Jeep", "Lincoln", "Pontiac", "Ram", "Tesla"
  ],
  "Szwajcaria": [],
  "Szwecja": ["Koenigsegg", "Rimac", "Saab"],
  "Turcja": [],
  "Ukraina": [],
  "Węgry": [],
  "Wielka Brytania": [
    "Aston Martin", "Bentley", "Jaguar", "Land Rover", "Lotus", "McLaren",
    "Mini", "Rolls-Royce", "Vauxhall"
  ],
  "Włochy": [
    "Abarth", "Alfa Romeo", "Fiat", "Ferrari", "Lamborghini", "Maserati", "Pagani"
  ],
  "Zjednoczone Emiraty Arabskie": []
};

const getCountryOfManufacturer = (make) => {
  if (!make) return null;
  const normalizedMake = make.trim().toLowerCase();

  for (const [country, brands] of Object.entries(COUNTRY_MAPPING)) {
    if (brands.some(brand => brand.toLowerCase() === normalizedMake)) {
      return country;
    }
  }
  return null;
};

// New: Upload images only (returns URLs)
exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }
    const urls = req.files.map((file) => file.cloudinaryUrl);
    res.json({ urls });
  } catch (error) {
    console.error("Upload Images Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Post a new car (Normal user)
exports.addCar = async (req, res) => {
  try {
    const { userId } = req;
    const user = await User.findById(userId);
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
      isFeatured,
      warranties,
    } = req.body;

    // console.log("title:", title);
    // console.log("description:", description);
    // console.log("make:", make);
    // console.log("model:", model);
    // console.log("type:", type);
    // console.log("condition:", condition);
    // console.log("financialInfo (raw):", financialInfo);
    let fi;
    try {
      fi =
        typeof financialInfo === "string"
          ? JSON.parse(financialInfo)
          : financialInfo;
    } catch (e) {
      fi = financialInfo;
    }
    if (!title) console.log("Missing: title");
    if (!description) console.log("Missing: description");
    if (!make) console.log("Missing: make");
    if (!model) console.log("Missing: model");
    if (!type) console.log("Missing: type");
    if (!condition) console.log("Missing: condition");
    if (!financialInfo) console.log("Missing: financialInfo");
    if (fi) {
      if (!fi.sellOptions) console.log("Missing: financialInfo.sellOptions");
      if (!fi.invoiceOptions)
        console.log("Missing: financialInfo.invoiceOptions");
      if (!fi.priceNetto) console.log("Missing: financialInfo.priceNetto");
    }

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

    // Combine images from pre-uploaded URLs (req.body.images) and new files (req.files)
    let images = [];
    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images = [...req.body.images];
      } else if (typeof req.body.images === "string") {
        images.push(req.body.images);
      }
    }

    if (req.files && req.files.length > 0) {
      const newUrls = req.files.map((file) => file.cloudinaryUrl);
      images = [...images, ...newUrls];
    }

    // Detect and categorize images (BACKGROUND PROCESS)
    // We respond to the user immediately, and process images asynchronously.
    // Initial categorizedImages will be just the URLs with status 'processing' or 'unknown'

    // Create initial list with 'pending' status if needed, or just default unknown
    const categorizedImages = images.map((url, i) => ({
      url,
      category: "unknown",
      detected_label: "Processing...",
      confidence: 0,
      index: i
    }));

    // Trigger background detection
    (async () => {
      try {
        console.log(`Starting background detection for ${images.length} images...`);
        const imageDetectionController = require("./imageDetection");
        const finalCategorized = [];

        // Use concurrency limit for detection to avoid overwhelming external API
        // Simple loop with await is fine for background, but parallel is faster.
        // Let's do chunks of 5
        const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunk(images, 5);

        let globalIndex = 0;
        for (const batch of batches) {
          await Promise.all(batch.map(async (url) => {
            const currentIndex = globalIndex++;
            try {
              const detectionResult = await imageDetectionController.detectImage(url);
              finalCategorized.push({
                url: url,
                category: detectionResult.category || "unknown",
                detected_label: detectionResult.detected_label,
                confidence: detectionResult.confidence,
                index: currentIndex
              });
            } catch (err) {
              console.error(`Background detection failed for image ${currentIndex}`, err);
              finalCategorized.push({
                url: url,
                category: "unknown",
                detected_label: "Unknown",
                confidence: 0,
                index: currentIndex
              });
            }
          }));
        }

        // Sort Logic (duplicated from before)
        if (finalCategorized.length > 1) {
          const CATEGORY_PRIORITY = [
            "exterior", "interior", "dashboard", "wheel", "engine", "documents", "keys"
          ];
          // Sort based on priority, keeping original index 0 (main) as main if possible?
          // Actually, usually Main Image is explicitly set by user as first. 
          // We should respect User's order for index 0, or sort all?
          // Previous code sorted all non-main images.

          // Re-find the items by url to ensure we adhere to "Main Image" rule if we want?
          // Or just sort the results.

          // Let's assume index 0 in 'images' is the main image the user chose.
          // We should find that one in finalCategorized

          const mainImageUrl = images[0];
          const mainImageObj = finalCategorized.find(img => img.url === mainImageUrl) || finalCategorized[0];
          const otherImages = finalCategorized.filter(img => img.url !== mainImageUrl);

          otherImages.sort((a, b) => {
            const catA = a.category ? a.category.toLowerCase() : "unknown";
            const catB = b.category ? b.category.toLowerCase() : "unknown";
            let indexA = CATEGORY_PRIORITY.indexOf(catA);
            let indexB = CATEGORY_PRIORITY.indexOf(catB);
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;
            return indexA - indexB;
          });

          // Re-assign to final list
          const sorted = [mainImageObj, ...otherImages];
          // Re-index
          sorted.forEach((img, idx) => img.index = idx);

          // Update the car record with sorted images and categorized info
          await Car.findByIdAndUpdate(car._id, {
            images: sorted.map(img => img.url),
            categorizedImages: sorted
          });
          console.log("Background detection and sorting complete.");
        } else {
          // Just update categorizedImages
          await Car.findByIdAndUpdate(car._id, { categorizedImages: finalCategorized });
        }

      } catch (bgError) {
        console.error("Background image processing error:", bgError);
      }
    })();

    // NOTE: We do NOT await the async IIFE above. We continue to save and respond.


    // Normalize warranties (may arrive as JSON string from multipart form)
    let parsedWarranties = undefined;
    if (typeof warranties !== "undefined") {
      try {
        parsedWarranties =
          typeof warranties === "string" ? JSON.parse(warranties) : warranties;
      } catch (e) {
        parsedWarranties = Array.isArray(warranties) ? warranties : [];
      }
    }

    // Process financialInfo to handle possible comma-separated strings
    const processedFinancialInfo = {
      ...fi,
      sellOptions: Array.isArray(fi.sellOptions)
        ? fi.sellOptions
        : String(fi.sellOptions)
          .split(",")
          .map((option) => option.trim()),
      invoiceOptions: Array.isArray(fi.invoiceOptions)
        ? fi.invoiceOptions
        : String(fi.invoiceOptions)
          .split(",")
          .map((option) => option.trim()),
      priceNetto: parseFloat(fi.priceNetto),
    };

    // Normalize isFeatured from multipart (string) or json
    const isFeaturedBool = String(isFeatured).toLowerCase() === "true";

    const car = new Car({
      createdBy: userId,
      title,
      description,
      images, // Keep for backward compatibility
      categorizedImages, // New field with categories
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
      countryOfManufacturer: getCountryOfManufacturer(make),
      carCondition: carCondition || {},
      warranties: parsedWarranties,
      financialInfo: {
        ...processedFinancialInfo,
        sellerType: user.sellerType, // Sync with user's sellerType
      },
      location: user.location,
      status: "Pending",
      isFeatured: isFeaturedBool,
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
    const { userId } = req; // Use authenticated user ID for security

    // console.log("userId", userId);
    const cars = await Car.find({ createdBy: userId });
    // Don't return 404 for empty results, just return empty array
    // console.log("cars", cars);
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
    const { userId } = req;
    const { carId } = req.params;
    const user = await User.findById(userId);
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
      isFeatured,
      warranties,
    } = req.body;

    let images = car.images;

    // Handle new image upload logic (mix of URLs and files)
    // If we have explicit images in body (URLs), start with those or replace?
    // Usually update replaces the list.
    let newImagesList = [];

    // 1. Get URLs from body
    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        newImagesList = [...req.body.images];
      } else if (typeof req.body.images === "string") {
        newImagesList.push(req.body.images);
      }
    } else {
      // If no images in body, keep existing? 
      // Only if we also have no files. 
      // But if user deleted all images, they might send empty array?
      // This logic depends on frontend. Let's assume if body.images is sent, it's the master list.
      if (!req.files || req.files.length === 0) {
        newImagesList = car.images; // Keep existing if nothing sent
      }
    }

    // 2. Add any new files
    if (req.files && req.files.length > 0) {
      const newUrls = req.files.map((file) => file.cloudinaryUrl);
      newImagesList = [...newImagesList, ...newUrls];
    }

    images = newImagesList;

    // Detect and categorize new images if any were checked/uploaded
    // Note: re-detecting everything might be expensive if we just reordered.
    // Optimization: only detect if no category present?
    // Current logic re-detects everything. For 100 images this could be slow.
    // But since detection is async loop inside controller, it delays response.
    // For now, keep existing logic but apply to 'images'.

    let categorizedImages = []; // Re-evaluate all or merge?
    // The previous logic took 'images' (which were only new files) and appended to car.categorizedImages?
    // Wait, previous logic: "images = req.files... ? ... : car.images"
    // Then "if (req.files) ... detect ... categorizedImages = [] ... push new ones"
    // It seemed to only detect NEW files.
    // If we use mixed input, we might have some old URLs (already categorized) and some new ones.

    // Simplest approach: Re-build categorized images.
    // If URL matches existing categorized image, copy it. Else detect.

    const imageDetectionController = require("./imageDetection");

    for (let i = 0; i < images.length; i++) {
      const url = images[i];
      // Check if we already have categorization for this URL
      const existing = car.categorizedImages?.find(img => img.url === url);

      if (existing) {
        categorizedImages.push({ ...existing, index: i });
      } else {
        // New image (from file or new URL), detect it
        try {
          const detectionResult = await imageDetectionController.detectImage(url);
          categorizedImages.push({
            url: url,
            category: detectionResult.category || "unknown",
            detected_label: detectionResult.detected_label,
            confidence: detectionResult.confidence,
            index: i,
          });
        } catch (error) {
          console.error(`Failed to detect image ${i + 1}:`, error);
          categorizedImages.push({
            url: url,
            category: "unknown",
            detected_label: "Unknown",
            confidence: 0,
            index: i
          });
        }
      }
    }

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
    if (images.length > 0) {
      updateData.images = images; // Keep for backward compatibility
      updateData.categorizedImages = categorizedImages; // New field with categories
    }
    if (make) {
      updateData.make = make;
      updateData.countryOfManufacturer = getCountryOfManufacturer(make);
    }
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
    if (typeof warranties !== "undefined") {
      let parsedWarranties = warranties;
      if (typeof warranties === "string") {
        try {
          parsedWarranties = JSON.parse(warranties);
        } catch (e) {
          parsedWarranties = [];
        }
      }
      updateData.warranties = parsedWarranties;
    }
    if (typeof isFeatured !== 'undefined') {
      updateData.isFeatured = String(isFeatured).toLowerCase() === 'true';
    }
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
    const { userId } = req;
    const { carId } = req.params;
    const user = await User.findById(userId);
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

    await Car.findByIdAndDelete(carId);
    res.json({ message: "Car deleted successfully" });
  } catch (error) {
    console.error("Delete Car Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all cars (Public)
exports.getAllCars = async (req, res) => {
  try {
    const cars = await Car.find({ status: "Approved" }).populate(
      "createdBy",
      "firstName lastName"
    );
    res.status(200).json(cars); // Returns an array of cars
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get featured cars (Public)
exports.getFeaturedCars = async (req, res) => {
  try {
    const cars = await Car.find({ isFeatured: true, status: "Approved" }).sort({
      createdAt: -1,
    });
    res.status(200).json(cars);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single car by ID (Public)
exports.getCarById = async (req, res) => {
  try {
    console.log("req.params:", req.params);
    const { carId } = req.params;
    const car = await Car.findById(carId);
    if (!car || car.status !== "Approved") {
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
    const { userId } = req;
    const { carId } = req.params;
    let { status } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    // Normalize status (accept case-insensitive and legacy values)
    if (typeof status === "string") {
      const raw = status.trim().toLowerCase();
      const legacyMap = { available: "Approved", pending: "Pending", suspended: "Rejected", rejected: "Rejected", approved: "Approved" };
      status = legacyMap[raw] || (raw.charAt(0).toUpperCase() + raw.slice(1));
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
      minMileage,
      drivetrain,
      transmission,
      fuel,
      engine,
      serviceHistory,
      accidentHistory,
      countryOfManufacturer,
      page = 1,
      limit = 10,
    } = req.query;

    // DEBUG: Log country filter parameter
    console.log("🔍 searchCars - countryOfManufacturer param:", countryOfManufacturer);

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
    if (countryOfManufacturer) {
      query.countryOfManufacturer = countryOfManufacturer;
      console.log("✅ Country filter applied to query:", countryOfManufacturer);
    }

    // Year range filter
    if (yearFrom && yearTo) {
      query.year = { $gte: yearFrom, $lte: yearTo };
    }

    // Mileage filter (support range)
    if (minMileage || mileage) {
      query.mileage = {};
      if (minMileage) {
        query.mileage.$gte = parseInt(minMileage, 10);
      }
      if (mileage) {
        query.mileage.$lte = parseInt(mileage, 10);
      }
    }

    // Only approved cars for public search
    query.status = "Approved";

    // DEBUG: Log the complete query
    console.log("🔍 searchCars - Complete query:", JSON.stringify(query, null, 2));

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalCars = await Car.countDocuments(query);
    const cars = await Car.find(query).skip(skip).limit(limitNum);

    // DEBUG: Log results
    console.log(`🔍 searchCars - Found ${totalCars} total cars, returning ${cars.length} cars`);
    if (countryOfManufacturer && cars.length > 0) {
      console.log("🔍 Sample car countryOfManufacturer values:",
        cars.slice(0, 3).map(c => ({ make: c.make, country: c.countryOfManufacturer }))
      );
    }

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
      status: "Approved",
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

// Admin endpoints

// Get car statistics for admin dashboard
exports.getCarStats = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    // Total cars
    const totalCars = await Car.countDocuments();

    // Cars by status
    const carsByStatus = await Car.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Cars by make
    const carsByMake = await Car.aggregate([
      {
        $group: {
          _id: "$make",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Cars by condition
    const carsByCondition = await Car.aggregate([
      {
        $group: {
          _id: "$carCondition.overall",
          count: { $sum: 1 },
        },
      },
    ]);

    // Cars by seller type
    const carsBySellerType = await Car.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "seller",
        },
      },
      {
        $unwind: "$seller",
      },
      {
        $group: {
          _id: "$seller.sellerType",
          count: { $sum: 1 },
        },
      },
    ]);

    // New cars per month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const newCarsPerMonth = await Car.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Average price by make
    const avgPriceByMake = await Car.aggregate([
      {
        $match: {
          "financialInfo.priceNetto": { $exists: true, $ne: "" },
        },
      },
      {
        $addFields: {
          priceAsNumber: { $toDouble: "$financialInfo.priceNetto" },
        },
      },
      {
        $group: {
          _id: "$make",
          avgPrice: { $avg: "$priceAsNumber" },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gte: 5 }, // Only include makes with at least 5 cars
        },
      },
      {
        $sort: { avgPrice: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    res.json({
      totalCars,
      carsByStatus,
      carsByMake,
      carsByCondition,
      carsBySellerType,
      newCarsPerMonth,
      avgPriceByMake,
    });
  } catch (error) {
    console.error("Error getting car stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all cars for admin with pagination and filtering
exports.getAllCarsForAdmin = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const matchFilter = {};
    if (req.query.make) matchFilter.make = req.query.make;
    if (req.query.model) matchFilter.model = req.query.model;
    if (req.query.status) matchFilter.status = req.query.status;
    if (req.query.condition)
      matchFilter["carCondition.overall"] = req.query.condition;
    if (req.query.search) {
      matchFilter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { make: { $regex: req.query.search, $options: "i" } },
        { model: { $regex: req.query.search, $options: "i" } },
        { vin: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Use aggregation with lookup to join with users
    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "creator",
        },
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ["$creator", 0] },
        },
      },
      {
        $project: {
          creator: 0,
          __v: 0,
          "createdBy._id": 0,
          "createdBy.__v": 0,
          "createdBy.socialMedia": 0,
          "createdBy.phoneNumbers": 0,
          "createdBy.location": 0,
          "createdBy.image": 0,
          "createdBy.description": 0,
          "createdBy.brands": 0,
          "createdBy.blocked": 0,
          "createdBy.role": 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const cars = await Car.aggregate(pipeline);
    const totalCars = await Car.countDocuments(matchFilter);
    const totalPages = Math.ceil(totalCars / limit);

    res.json({
      cars,
      currentPage: page,
      totalPages,
      totalCars,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  } catch (error) {
    console.error("Error getting cars for admin:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to update car status
exports.updateCarStatusAdmin = async (req, res) => {
  try {
    const { carId } = req.params;
    let { status } = req.body;

    // Remove admin check for now - direct access

    // Normalize status (accept case-insensitive and legacy values)
    if (typeof status === "string") {
      const raw = status.trim().toLowerCase();
      const legacyMap = { available: "Approved", pending: "Pending", suspended: "Rejected", rejected: "Rejected", approved: "Approved" };
      status = legacyMap[raw] || (raw.charAt(0).toUpperCase() + raw.slice(1));
    }

    const allowed = ["Pending", "Approved", "Rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(", ")}` });
    }

    const updatedCar = await Car.findByIdAndUpdate(
      carId,
      { status },
      { new: true }
    );

    if (!updatedCar) {
      return res.status(404).json({ message: "Car not found" });
    }

    res.json({
      message: "Car status updated successfully",
      car: updatedCar,
    });
  } catch (error) {
    console.error("Error updating car status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to delete car
exports.deleteCarAdmin = async (req, res) => {
  try {
    const { carId } = req.params;

    // Remove admin check for now - direct access

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Delete car from database
    await Car.findByIdAndDelete(carId);

    res.json({
      message: "Car deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting car:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
