const { BuyerRequest, User, SellerOffer } = require("../models");

// Create a new buyer request
exports.createBuyerRequest = async (req, res) => {
  try {
    console.log("createBuyerRequest called");
    console.log("Request body:", req.body);
    console.log("Auth object:", req.auth);

    const { userId } = req.auth || {};
    console.log("userId from auth:", userId);

    if (!userId) {
      console.error("No userId found in request auth");
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findOne({ clerkUserId: userId });
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
    console.log("getBuyerRequestsByUserId called");
    console.log("Auth object:", req.auth);

    const { userId } = req.auth || {};
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
    const { userId } = req.auth;
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
    const { userId } = req.auth;
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
    const { userId } = req.auth;
    const { requestId } = req.params;

    const buyerRequest = await BuyerRequest.findById(requestId);
    if (!buyerRequest) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    if (buyerRequest.buyerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const offers = await SellerOffer.find({ requestId })
      .sort({ createdAt: -1 })
      .populate("carId");

    res.json(offers);
  } catch (error) {
    console.error("Get Offers For Request Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Debug function to check buyer requests
exports.debugBuyerRequests = async (req, res) => {
  try {
    console.log("Debug buyer requests called");

    const { userId } = req.auth || {};
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
