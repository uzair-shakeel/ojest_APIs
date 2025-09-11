const { BuyerRequest, User, SellerOffer, Car } = require("../models");

// Create a new buyer request
exports.createBuyerRequest = async (req, res) => {
  try {
    const { userId } = req || {};
    console.log("userId from auth:", userId);

    if (!userId) {
      console.error("No userId found in request auth");
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findById(userId);
    console.log("User found:", user ? user._id : "No user found");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    const {
      title,
      description,
      make,
      model,
      type,
      budgetMin,
      budgetMax,
      preferredCondition,
      preferredFeatures,
      location,
    } = req.body;

    // Validate required fields
    if (!title || !description || !budgetMax) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let coordinates = user.location.coordinates;
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

    // Create the buyer request object with the correct buyerId
    const buyerRequestData = {
      buyerId: userId,
      title,
      description,
      make,
      model,
      type,
      budgetMin,
      budgetMax,
      preferredCondition,
      preferredFeatures: preferredFeatures || [],
      location: {
        type: "Point",
        coordinates: [parseFloat(coordinates[0]), parseFloat(coordinates[1])],
      },
    };

    console.log("Creating buyer request with data:", buyerRequestData);
    const buyerRequest = new BuyerRequest(buyerRequestData);

    await buyerRequest.save();
    console.log("Buyer request created:", buyerRequest);
    console.log("Buyer request ID:", buyerRequest._id);
    console.log("Buyer request buyerId:", buyerRequest.buyerId);

    res
      .status(201)
      .json({ message: "Buyer request created successfully", buyerRequest });
  } catch (error) {
    console.error("Create Buyer Request Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all buyer requests (with filters)
exports.getAllBuyerRequests = async (req, res) => {
  try {
    const {
      make,
      model,
      type,
      budgetMin,
      budgetMax,
      status = "Active",
      page = 1,
      limit = 10,
    } = req.query;

    const query = { status };

    if (make) query.make = make;
    if (model) query.model = model;
    if (type) query.type = type;

    if (budgetMin || budgetMax) {
      query.budgetMax = {};
      if (budgetMin) query.budgetMax.$gte = parseFloat(budgetMin);
      if (budgetMax) query.budgetMin = { $lte: parseFloat(budgetMax) };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalRequests = await BuyerRequest.countDocuments(query);
    const buyerRequests = await BuyerRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      buyerRequests,
      total: totalRequests,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalRequests / limitNum),
    });
  } catch (error) {
    console.error("Get All Buyer Requests Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get buyer requests by user ID
exports.getBuyerRequestsByUserId = async (req, res) => {
  try {
    const { userId } = req || {};
    console.log("userId from auth:", userId);

    if (!userId) {
      console.error("No userId found in request auth");
      return res.status(401).json({ message: "Authentication required" });
    }

    const { status, page = 1, limit = 10 } = req.query;
    console.log("Query params:", { status, page, limit });

    // Debug: List all buyer requests in the database
    const allRequests = await BuyerRequest.find().limit(20);
    console.log(
      "All buyer requests in DB:",
      allRequests.map((r) => ({
        id: r._id,
        buyerId: r.buyerId,
        title: r.title,
        status: r.status,
      }))
    );

    // Build the query with the correct buyerId
    const query = { buyerId: userId };

    // Handle status case correctly - capitalize first letter if provided
    if (status) {
      // Convert status to proper case (e.g., "active" -> "Active")
      const formattedStatus =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      query.status = formattedStatus;
      console.log("Formatted status for query:", formattedStatus);
    }

    console.log("MongoDB query:", query);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalRequests = await BuyerRequest.countDocuments(query);
    console.log("Total matching requests:", totalRequests);

    const buyerRequests = await BuyerRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    console.log("Found buyer requests:", buyerRequests.length);
    console.log(
      "Buyer requests data:",
      buyerRequests.map((r) => ({
        id: r._id,
        buyerId: r.buyerId,
        title: r.title,
        status: r.status,
      }))
    );

    res.json({
      buyerRequests,
      total: totalRequests,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalRequests / limitNum),
    });
  } catch (error) {
    console.error("Get Buyer Requests By User ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a single buyer request by ID
exports.getBuyerRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;

    const buyerRequest = await BuyerRequest.findById(requestId);
    if (!buyerRequest) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    res.json(buyerRequest);
  } catch (error) {
    console.error("Get Buyer Request By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a buyer request
exports.updateBuyerRequest = async (req, res) => {
  try {
    const { userId } = req;
    const { requestId } = req.params;

    const buyerRequest = await BuyerRequest.findById(requestId);
    if (!buyerRequest) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    if (buyerRequest.buyerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (buyerRequest.status !== "Active") {
      return res
        .status(400)
        .json({ message: "Only active requests can be updated" });
    }

    const {
      title,
      description,
      make,
      model,
      yearFrom,
      yearTo,
      budgetMin,
      budgetMax,
      preferredCondition,
      preferredFeatures,
      location,
      status,
    } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (make) updateData.make = make;
    if (model) updateData.model = model;
    if (yearFrom) updateData.yearFrom = yearFrom;
    if (yearTo) updateData.yearTo = yearTo;
    if (budgetMin) updateData.budgetMin = budgetMin;
    if (budgetMax) updateData.budgetMax = budgetMax;
    if (preferredCondition) updateData.preferredCondition = preferredCondition;
    if (preferredFeatures) updateData.preferredFeatures = preferredFeatures;

    if (location && location.coordinates) {
      let coordinates;
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

      updateData.location = {
        type: "Point",
        coordinates: [parseFloat(coordinates[0]), parseFloat(coordinates[1])],
      };
    }

    if (status) updateData.status = status;

    const updatedRequest = await BuyerRequest.findByIdAndUpdate(
      requestId,
      { $set: updateData },
      { new: true }
    );

    res.json({
      message: "Buyer request updated successfully",
      buyerRequest: updatedRequest,
    });
  } catch (error) {
    console.error("Update Buyer Request Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a buyer request
exports.deleteBuyerRequest = async (req, res) => {
  try {
    const { userId } = req;
    const { requestId } = req.params;

    const buyerRequest = await BuyerRequest.findById(requestId);
    if (!buyerRequest) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    if (buyerRequest.buyerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if there are any accepted offers
    const acceptedOffers = await SellerOffer.findOne({
      requestId,
      status: "Accepted",
    });

    if (acceptedOffers) {
      return res.status(400).json({
        message: "Cannot delete request with accepted offers",
      });
    }

    // Update status to cancelled instead of deleting
    await BuyerRequest.findByIdAndUpdate(requestId, { status: "Cancelled" });

    res.json({ message: "Buyer request cancelled successfully" });
  } catch (error) {
    console.error("Delete Buyer Request Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get offers for a buyer request
exports.getOffersForRequest = async (req, res) => {
  try {
    const { userId } = req;
    const { requestId } = req.params;

    console.log("=== GET OFFERS FOR REQUEST DEBUG ===");
    console.log("userId:", userId);
    console.log("requestId:", requestId);

    const buyerRequest = await BuyerRequest.findById(requestId);
    if (!buyerRequest) {
      console.log("Buyer request not found for ID:", requestId);
      return res.status(404).json({ message: "Buyer request not found" });
    }

    console.log("Buyer request found:", {
      id: buyerRequest._id,
      buyerId: buyerRequest.buyerId,
      title: buyerRequest.title,
    });

    if (buyerRequest.buyerId !== userId) {
      console.log("Access denied - buyerId mismatch:", {
        requestBuyerId: buyerRequest.buyerId,
        authenticatedUserId: userId,
      });
      return res.status(403).json({ message: "Access denied" });
    }

    // Simple query - find offers by requestId
    const offers = await SellerOffer.find({ requestId }).sort({
      createdAt: -1,
    });

    // Get car details separately if carId exists
    const carIds = offers.filter((o) => o.carId).map((o) => o.carId);
    console.log("Car IDs found in offers:", carIds);

    const cars = await Car.find(
      { _id: { $in: carIds } },
      "make model year images"
    );
    console.log("Cars found:", cars.length);
    console.log(
      "Sample car data:",
      cars[0]
        ? {
            id: cars[0]._id,
            make: cars[0].make,
            model: cars[0].model,
            year: cars[0].year,
            imagesCount: cars[0].images ? cars[0].images.length : 0,
            images: cars[0].images,
          }
        : "No cars"
    );

    const carMap = {};
    cars.forEach((c) => (carMap[c._id.toString()] = c));

    // Attach car info to offers
    const offersWithCars = offers.map((offer) => ({
      ...offer.toObject(),
      carInfo: offer.carId ? carMap[offer.carId.toString()] || null : null,
    }));

    console.log(
      "Offers with car info:",
      offersWithCars.map((o) => ({
        id: o._id,
        carId: o.carId,
        hasCarInfo: !!o.carInfo,
        carImages: o.carInfo?.images?.length || 0,
      }))
    );

    // Get seller details separately since sellerId is a string
    const sellerIds = [...new Set(offersWithCars.map((o) => o.sellerId))];
    const sellers = await User.find(
      { _id: { $in: sellerIds } },
      "firstName lastName email sellerType companyName"
    );
    const sellerMap = {};
    sellers.forEach((s) => (sellerMap[s._id] = s));

    // Attach seller info to offers
    const offersWithSellers = offersWithCars.map((offer) => ({
      ...offer,
      sellerInfo: sellerMap[offer.sellerId] || null,
    }));

    console.log("Found offers:", offersWithSellers.length);
    console.log(
      "Offers:",
      offersWithSellers.map((o) => ({
        id: o._id,
        title: o.title,
        price: o.price,
        status: o.status,
        sellerName: o.sellerInfo
          ? o.sellerInfo.firstName + " " + o.sellerInfo.lastName
          : "Unknown",
      }))
    );

    res.json({ offers: offersWithSellers });
  } catch (error) {
    console.error("Get Offers For Request Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Debug function to check buyer requests
exports.debugBuyerRequests = async (req, res) => {
  try {
    console.log("Debug buyer requests called");

    const { userId } = req || {};
    console.log("Debug - userId from auth:", userId);

    // Get all buyer requests
    const allRequests = await BuyerRequest.find().limit(20);

    // Get requests for this user
    const userRequests = await BuyerRequest.find({ buyerId: userId });

    console.log(
      "Debug - All requests:",
      allRequests.map((r) => ({
        id: r._id,
        buyerId: r.buyerId,
        title: r.title,
      }))
    );

    console.log(
      "Debug - User requests:",
      userRequests.map((r) => ({
        id: r._id,
        buyerId: r.buyerId,
        title: r.title,
      }))
    );

    res.json({
      userId,
      totalRequests: allRequests.length,
      userRequestsCount: userRequests.length,
      allRequests: allRequests.map((r) => ({
        id: r._id,
        buyerId: r.buyerId,
        title: r.title,
        createdAt: r.createdAt,
      })),
      userRequests: userRequests.map((r) => ({
        id: r._id,
        buyerId: r.buyerId,
        title: r.title,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Debug Buyer Requests Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin endpoints

// Get buyer request statistics for admin dashboard
exports.getBuyerRequestStats = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    // Total buyer requests
    const totalRequests = await BuyerRequest.countDocuments();

    // Requests by status
    const requestsByStatus = await BuyerRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Requests by preferred condition
    const requestsByCondition = await BuyerRequest.aggregate([
      {
        $group: {
          _id: "$preferredCondition",
          count: { $sum: 1 },
        },
      },
    ]);

    // Requests by make
    const requestsByMake = await BuyerRequest.aggregate([
      {
        $match: {
          make: { $exists: true, $ne: "" },
        },
      },
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

    // New requests per month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const newRequestsPerMonth = await BuyerRequest.aggregate([
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

    // Average budget range
    const budgetStats = await BuyerRequest.aggregate([
      {
        $match: {
          budgetMax: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgBudgetMax: { $avg: "$budgetMax" },
          avgBudgetMin: { $avg: "$budgetMin" },
          maxBudget: { $max: "$budgetMax" },
          minBudget: { $min: "$budgetMax" },
        },
      },
    ]);

    // Offers count per request
    const offersPerRequest = await SellerOffer.aggregate([
      {
        $group: {
          _id: "$requestId",
          offerCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          avgOffersPerRequest: { $avg: "$offerCount" },
          maxOffersPerRequest: { $max: "$offerCount" },
        },
      },
    ]);

    res.json({
      totalRequests,
      requestsByStatus,
      requestsByCondition,
      requestsByMake,
      newRequestsPerMonth,
      budgetStats: budgetStats[0] || {},
      offersPerRequest: offersPerRequest[0] || {},
    });
  } catch (error) {
    console.error("Error getting buyer request stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all buyer requests for admin with pagination and filtering
exports.getAllBuyerRequestsForAdmin = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const matchFilter = {};
    if (req.query.status) matchFilter.status = req.query.status;
    if (req.query.make) matchFilter.make = req.query.make;
    if (req.query.preferredCondition)
      matchFilter.preferredCondition = req.query.preferredCondition;
    if (req.query.search) {
      matchFilter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
        { make: { $regex: req.query.search, $options: "i" } },
        { model: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Use aggregation with lookup to join with users and get offer counts
    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: "users",
          localField: "buyerId",
          foreignField: "_id",
          as: "buyer",
        },
      },
      {
        $lookup: {
          from: "selleroffers",
          localField: "_id",
          foreignField: "requestId",
          as: "offers",
        },
      },
      {
        $addFields: {
          buyerId: { $arrayElemAt: ["$buyer", 0] },
          offerCount: { $size: "$offers" },
        },
      },
      {
        $project: {
          buyer: 0,
          offers: 0,
          __v: 0,
          "buyerId._id": 0,
          "buyerId.__v": 0,
          "buyerId.socialMedia": 0,
          "buyerId.phoneNumbers": 0,
          "buyerId.location": 0,
          "buyerId.image": 0,
          "buyerId.description": 0,
          "buyerId.companyName": 0,
          "buyerId.sellerType": 0,
          "buyerId.brands": 0,
          "buyerId.blocked": 0,
          "buyerId.role": 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const requests = await BuyerRequest.aggregate(pipeline);
    const totalRequests = await BuyerRequest.countDocuments(matchFilter);
    const totalPages = Math.ceil(totalRequests / limit);

    res.json({
      requests,
      currentPage: page,
      totalPages,
      totalRequests,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  } catch (error) {
    console.error("Error getting buyer requests for admin:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to update buyer request status
exports.updateBuyerRequestStatusAdmin = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    // Remove admin check for now - direct access

    if (!["Active", "Fulfilled", "Expired", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const request = await BuyerRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    request.status = status;
    await request.save();

    res.json({
      message: "Buyer request status updated successfully",
      request,
    });
  } catch (error) {
    console.error("Error updating buyer request status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to delete buyer request
exports.deleteBuyerRequestAdmin = async (req, res) => {
  try {
    const { requestId } = req.params;

    // Remove admin check for now - direct access

    const request = await BuyerRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    // Delete buyer request from database
    await BuyerRequest.findByIdAndDelete(requestId);

    res.json({
      message: "Buyer request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting buyer request:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
