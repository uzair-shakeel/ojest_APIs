const { SellerOffer, BuyerRequest, User, Car } = require("../models");

// Create a new offer for a buyer request
exports.createOffer = async (req, res) => {
  try {
    console.log("=== CREATE OFFER DEBUG ===");

    const { userId } = req;
    const { requestId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    const buyerRequest = await BuyerRequest.findById(requestId);
    if (!buyerRequest) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    if (buyerRequest.status !== "Active") {
      return res.status(400).json({
        message: "Cannot create offer for inactive request",
      });
    }

    // Check if seller has already made an offer for this request
    const existingOffer = await SellerOffer.findOne({
      requestId,
      sellerId: userId,
      status: { $in: ["Pending", "Accepted"] },
    });

    if (existingOffer) {
      return res.status(400).json({
        message: "You already have an active offer for this request",
      });
    }

    const { title, description, price, carId, isCustomOffer } = req.body;

    console.log("Received request body:", req.body);
    console.log("Extracted fields:", {
      title,
      description,
      price,
      carId,
      isCustomOffer,
    });

    // Validate required fields
    if (!title || !description || !price) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let images = [];

    // If using an existing car
    if (carId) {
      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }

      if (car.createdBy !== userId) {
        return res
          .status(403)
          .json({ message: "You can only offer your own cars" });
      }

      images = car.images;
    } else if (req.files && req.files.length > 0) {
      // If custom offer with new images
      images = req.files.map((file) => file.cloudinaryUrl);
    }

    const sellerOffer = new SellerOffer({
      requestId,
      sellerId: userId,
      carId: carId || null,
      title,
      description,
      price: parseFloat(price),
      images,
      status: "Pending", // Explicitly set to ensure correct case
      isCustomOffer: isCustomOffer || !carId,
    });

    await sellerOffer.save();

    res.status(201).json({
      message: "Offer created successfully",
      offer: sellerOffer,
    });
  } catch (error) {
    console.error("Create Seller Offer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all offers made by a seller
exports.getSellerOffers = async (req, res) => {
  try {
    console.log("getSellerOffers called");
    const { userId } = req;
    console.log("userId from auth:", userId);

    const { status, page = 1, limit = 10 } = req.query;
    console.log("Query params:", { status, page, limit });

    const query = { sellerId: userId };

    // Handle status case correctly if provided
    if (status) {
      // Convert status to proper case (e.g., "pending" -> "Pending")
      const formattedStatus =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      query.status = formattedStatus;
      console.log("Formatted status for query:", formattedStatus);
    }

    console.log("MongoDB query:", query);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Debug: List all seller offers in the database
    const allOffers = await SellerOffer.find().limit(20);
    console.log(
      "All seller offers in DB:",
      allOffers.map((o) => ({
        id: o._id,
        sellerId: o.sellerId,
        status: o.status,
        title: o.title,
      }))
    );

    const totalOffers = await SellerOffer.countDocuments(query);
    console.log("Total matching offers:", totalOffers);

    const offers = await SellerOffer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("requestId")
      .populate("carId");

    console.log("Found seller offers:", offers.length);

    res.json({
      offers,
      total: totalOffers,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalOffers / limitNum),
    });
  } catch (error) {
    console.error("Get Seller Offers Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a single offer by ID
exports.getOfferById = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await SellerOffer.findById(offerId)
      .populate("requestId")
      .populate("carId");

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    res.json(offer);
  } catch (error) {
    console.error("Get Offer By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update an offer
exports.updateOffer = async (req, res) => {
  try {
    const { userId } = req;
    const { offerId } = req.params;

    const offer = await SellerOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.sellerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (offer.status !== "Pending") {
      return res.status(400).json({
        message: "Only pending offers can be updated",
      });
    }

    const { title, description, price, carId } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (price) updateData.price = parseFloat(price);

    if (carId && carId !== offer.carId) {
      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }

      if (car.createdBy !== userId) {
        return res
          .status(403)
          .json({ message: "You can only offer your own cars" });
      }

      updateData.carId = carId;
      updateData.images = car.images;
      updateData.isCustomOffer = false;
    } else if (req.files && req.files.length > 0) {
      // If updating with new images
      updateData.images = req.files.map((file) => file.cloudinaryUrl);
    }

    const updatedOffer = await SellerOffer.findByIdAndUpdate(
      offerId,
      { $set: updateData },
      { new: true }
    );

    res.json({
      message: "Offer updated successfully",
      offer: updatedOffer,
    });
  } catch (error) {
    console.error("Update Offer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete/cancel an offer
exports.deleteOffer = async (req, res) => {
  try {
    const { userId } = req;
    const { offerId } = req.params;

    const offer = await SellerOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.sellerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (offer.status === "Accepted") {
      return res.status(400).json({
        message: "Cannot delete an accepted offer",
      });
    }

    await SellerOffer.findByIdAndUpdate(offerId, { status: "Cancelled" });

    res.json({ message: "Offer cancelled successfully" });
  } catch (error) {
    console.error("Delete Offer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Accept an offer (buyer only)
exports.acceptOffer = async (req, res) => {
  try {
    const { userId } = req;
    const { offerId } = req.params;

    const offer = await SellerOffer.findById(offerId).populate("requestId");
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (!offer.requestId) {
      return res.status(404).json({ message: "Associated request not found" });
    }

    if (offer.requestId.buyerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (offer.status !== "Pending") {
      return res.status(400).json({
        message: "Only pending offers can be accepted",
      });
    }

    // Update the offer status
    await SellerOffer.findByIdAndUpdate(offerId, { status: "Accepted" });

    // Update the request status
    await BuyerRequest.findByIdAndUpdate(offer.requestId._id, {
      status: "Fulfilled",
    });

    // Reject all other offers for this request
    await SellerOffer.updateMany(
      {
        requestId: offer.requestId._id,
        _id: { $ne: offerId },
        status: "Pending",
      },
      { status: "Rejected" }
    );

    res.json({ message: "Offer accepted successfully" });
  } catch (error) {
    console.error("Accept Offer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Reject an offer (buyer only)
exports.rejectOffer = async (req, res) => {
  try {
    const { userId } = req;
    const { offerId } = req.params;

    const offer = await SellerOffer.findById(offerId).populate("requestId");
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (!offer.requestId) {
      return res.status(404).json({ message: "Associated request not found" });
    }

    if (offer.requestId.buyerId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (offer.status !== "Pending") {
      return res.status(400).json({
        message: "Only pending offers can be rejected",
      });
    }

    await SellerOffer.findByIdAndUpdate(offerId, { status: "Rejected" });

    res.json({ message: "Offer rejected successfully" });
  } catch (error) {
    console.error("Reject Offer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get available buyer requests for sellers
exports.getAvailableBuyerRequests = async (req, res) => {
  try {
    console.log("getAvailableBuyerRequests called");
    const { userId } = req;
    console.log("userId from auth:", userId);

    const { make, model, page = 1, limit = 10 } = req.query;
    console.log("Query params:", { make, model, page, limit });

    // Find the current user to get their brands and seller type
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only process requests for company sellers
    if (user.sellerType !== "company") {
      return res.status(403).json({
        message: "Only company sellers can view available requests",
      });
    }

    // Always use "Active" with capital A to match the database
    const query = {
      status: "Active",
      expiryDate: { $gt: new Date() },
    };

    // Filter by seller's brands
    if (user.brands && user.brands.length > 0) {
      query.make = { $in: user.brands };
    }

    if (make) query.make = make;
    if (model) query.model = model;

    console.log("MongoDB query:", query);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Find requests where the seller hasn't already made an offer
    const existingOffers = await SellerOffer.find({
      sellerId: userId,
      status: { $in: ["Pending", "Accepted"] },
    }).distinct("requestId");

    console.log("Existing offers count:", existingOffers.length);

    if (existingOffers.length > 0) {
      query._id = { $nin: existingOffers };
    }

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
        make: r.make,
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
    console.error("Get Available Buyer Requests Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Debug function to check seller offers
exports.debugSellerOffers = async (req, res) => {
  try {
    console.log("Debug seller offers called");

    const { userId } = req || {};
    console.log("Debug - userId from auth:", userId);

    const { SellerOffer, BuyerRequest } = require("../models");

    // Get all seller offers
    const allOffers = await SellerOffer.find().limit(20);

    // Get offers for this user
    const userOffers = await SellerOffer.find({ sellerId: userId });

    console.log(
      "Debug - All offers:",
      allOffers.map((o) => ({
        id: o._id,
        sellerId: o.sellerId,
        requestId: o.requestId,
        title: o.title,
      }))
    );

    console.log(
      "Debug - User offers:",
      userOffers.map((o) => ({
        id: o._id,
        sellerId: o.sellerId,
        requestId: o.requestId,
        title: o.title,
      }))
    );

    res.json({
      userId,
      totalOffers: allOffers.length,
      userOffersCount: userOffers.length,
      allOffers: allOffers.map((o) => ({
        id: o._id,
        sellerId: o.sellerId,
        requestId: o.requestId,
        title: o.title,
        createdAt: o.createdAt,
      })),
      userOffers: userOffers.map((o) => ({
        id: o._id,
        sellerId: o.sellerId,
        requestId: o.requestId,
        title: o.title,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error("Debug Seller Offers Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get seller offer statistics for admin dashboard
exports.getSellerOfferStats = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    // Total seller offers
    const totalOffers = await SellerOffer.countDocuments();

    // Offers by status
    const offersByStatus = await SellerOffer.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Average offer price
    const avgOfferPrice = await SellerOffer.aggregate([
      {
        $match: {
          offerPrice: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgPrice: { $avg: "$offerPrice" },
        },
      },
    ]);

    // New offers per month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const newOffersPerMonth = await SellerOffer.aggregate([
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

    // Offers by seller type
    const offersBySellerType = await SellerOffer.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "sellerId",
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

    res.json({
      totalOffers,
      offersByStatus,
      avgOfferPrice: avgOfferPrice[0]?.avgPrice || 0,
      newOffersPerMonth,
      offersBySellerType,
    });
  } catch (error) {
    console.error("Error getting seller offer stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all seller offers for admin with pagination and filtering
exports.getAllSellerOffersForAdmin = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const matchFilter = {};
    if (req.query.status) matchFilter.status = req.query.status;
    if (req.query.requestId) matchFilter.requestId = req.query.requestId;
    if (req.query.search) {
      matchFilter.$or = [
        { message: { $regex: req.query.search, $options: "i" } },
        { "carDetails.make": { $regex: req.query.search, $options: "i" } },
        { "carDetails.model": { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Use aggregation with lookup to join with users and buyer requests
    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: "users",
          localField: "sellerId",
          foreignField: "_id",
          as: "seller",
        },
      },
      {
        $lookup: {
          from: "buyerrequests",
          localField: "requestId",
          foreignField: "_id",
          as: "request",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "request.buyerId",
          foreignField: "_id",
          as: "buyer",
        },
      },
      {
        $addFields: {
          sellerId: { $arrayElemAt: ["$seller", 0] },
          requestId: {
            $mergeObjects: [
              { $arrayElemAt: ["$request", 0] },
              { buyerId: { $arrayElemAt: ["$buyer", 0] } },
            ],
          },
        },
      },
      {
        $project: {
          seller: 0,
          request: 0,
          buyer: 0,
          __v: 0,
          "sellerId._id": 0,
          "sellerId.__v": 0,
          "sellerId.socialMedia": 0,
          "sellerId.phoneNumbers": 0,
          "sellerId.location": 0,
          "sellerId.image": 0,
          "sellerId.description": 0,
          "sellerId.brands": 0,
          "sellerId.blocked": 0,
          "sellerId.role": 0,
          "requestId.buyerId._id": 0,
          "requestId.buyerId.__v": 0,
          "requestId.buyerId.socialMedia": 0,
          "requestId.buyerId.phoneNumbers": 0,
          "requestId.buyerId.location": 0,
          "requestId.buyerId.image": 0,
          "requestId.buyerId.description": 0,
          "requestId.buyerId.companyName": 0,
          "requestId.buyerId.sellerType": 0,
          "requestId.buyerId.brands": 0,
          "requestId.buyerId.blocked": 0,
          "requestId.buyerId.role": 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const offers = await SellerOffer.aggregate(pipeline);
    const totalOffers = await SellerOffer.countDocuments(matchFilter);
    const totalPages = Math.ceil(totalOffers / limit);

    res.json({
      offers,
      currentPage: page,
      totalPages,
      totalOffers,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  } catch (error) {
    console.error("Error getting seller offers for admin:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to update seller offer status
exports.updateSellerOfferStatusAdmin = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { status } = req.body;

    // Remove admin check for now - direct access

    if (!["pending", "accepted", "rejected", "withdrawn"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const offer = await SellerOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Seller offer not found" });
    }

    offer.status = status;
    await offer.save();

    res.json({
      message: "Seller offer status updated successfully",
      offer,
    });
  } catch (error) {
    console.error("Error updating seller offer status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to delete seller offer
exports.deleteSellerOfferAdmin = async (req, res) => {
  try {
    const { offerId } = req.params;

    // Remove admin check for now - direct access

    const offer = await SellerOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ message: "Seller offer not found" });
    }

    await SellerOffer.findByIdAndDelete(offerId);

    res.json({
      message: "Seller offer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting seller offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Regular functions for the main app
exports.createSellerOffer = async (req, res) => {
  try {
    console.log("=== CREATE SELLER OFFER DEBUG ===");
    console.log("Request method:", req.method);
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    console.log("Request params:", req.params);
    console.log("Request query:", req.query);
    console.log("Files:", req.files);

    // Test database connection
    console.log("Testing database connection...");
    const testCount = await SellerOffer.countDocuments();
    console.log("Current SellerOffer count in database:", testCount);

    const { userId } = req;
    const { requestId, title, description, price, carId, isCustomOffer } =
      req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if buyer request exists
    console.log("Looking for buyer request with ID:", requestId);
    const buyerRequest = await BuyerRequest.findById(requestId);
    console.log(
      "Buyer request lookup result:",
      buyerRequest
        ? {
            id: buyerRequest._id,
            title: buyerRequest.title,
            status: buyerRequest.status,
          }
        : "NOT FOUND"
    );

    if (!buyerRequest) {
      return res.status(404).json({ message: "Buyer request not found" });
    }

    // Check if seller has already made an offer for this request
    const existingOffer = await SellerOffer.findOne({
      sellerId: userId,
      requestId: requestId,
    });

    if (existingOffer) {
      return res
        .status(400)
        .json({ message: "You have already made an offer for this request" });
    }

    // Validate required fields
    if (!title || !description || !price) {
      return res.status(400).json({
        message:
          "Missing required fields: title, description, and price are required",
      });
    }

    let images = [];

    // If using an existing car
    if (carId) {
      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }

      if (car.createdBy !== userId) {
        return res
          .status(403)
          .json({ message: "You can only offer your own cars" });
      }

      images = car.images;
    } else if (req.files && req.files.length > 0) {
      // If custom offer with new images
      images = req.files.map((file) => file.cloudinaryUrl);
    }

    console.log("Creating SellerOffer with data:", {
      sellerId: userId,
      requestId,
      carId: carId || null,
      title,
      description,
      price: parseFloat(price),
      images,
      status: "Pending",
      isCustomOffer: isCustomOffer || !carId,
    });

    const newOffer = new SellerOffer({
      sellerId: userId,
      requestId,
      carId: carId || null,
      title,
      description,
      price: parseFloat(price),
      images,
      status: "Pending", // Fixed: use capital P to match enum
      isCustomOffer: isCustomOffer || !carId,
    });

    console.log("About to save SellerOffer to database...");
    try {
      await newOffer.save();
      console.log("SellerOffer saved successfully:", newOffer._id);
      console.log("Saved offer requestId:", newOffer.requestId);
      console.log("Full saved offer:", newOffer.toObject());
    } catch (saveError) {
      console.error("Error saving SellerOffer:", saveError);
      console.error("Validation errors:", saveError.errors);
      throw saveError;
    }

    res.status(201).json({
      message: "Seller offer created successfully",
      offer: newOffer,
    });
  } catch (error) {
    console.error("Error creating seller offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getOffersForRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    console.log("=== GET OFFERS FOR REQUEST (sellerOffer.js) DEBUG ===");
    console.log("requestId:", requestId);

    // Simple query - find offers by requestId
    const offers = await SellerOffer.find({ requestId }).sort({
      createdAt: -1,
    });

    // Get car details separately if carId exists
    const carIds = offers.filter((o) => o.carId).map((o) => o.carId);
    const cars = await Car.find(
      { _id: { $in: carIds } },
      "make model year images"
    );
    const carMap = {};
    cars.forEach((c) => (carMap[c._id.toString()] = c));

    // Get seller details separately since sellerId is a string
    const sellerIds = [...new Set(offers.map((o) => o.sellerId))];
    const sellers = await User.find(
      { _id: { $in: sellerIds } },
      "firstName lastName email sellerType companyName"
    );
    const sellerMap = {};
    sellers.forEach((s) => (sellerMap[s._id] = s));

    // Attach both car and seller info to offers
    const offersWithDetails = offers.map((offer) => ({
      ...offer.toObject(),
      carInfo: offer.carId ? carMap[offer.carId.toString()] || null : null,
      sellerInfo: sellerMap[offer.sellerId] || null,
    }));

    console.log("Found offers:", offersWithDetails.length);
    console.log(
      "Offers:",
      offersWithDetails.map((o) => ({
        id: o._id,
        title: o.title,
        price: o.price,
        status: o.status,
        sellerName: o.sellerInfo
          ? o.sellerInfo.firstName + " " + o.sellerInfo.lastName
          : "Unknown",
        carInfo: o.carInfo
          ? `${o.carInfo.make} ${o.carInfo.model} ${o.carInfo.year}`
          : "Custom offer",
      }))
    );

    res.json({ offers: offersWithDetails });
  } catch (error) {
    console.error("Error getting offers for request:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getSellerOffersBySellerId = async (req, res) => {
  try {
    const { userId } = req;

    console.log("=== GET SELLER OFFERS BY SELLER ID DEBUG ===");
    console.log("userId:", userId);
    console.log("userId type:", typeof userId);

    // First, let's see what's in the database
    const allOffers = await SellerOffer.find().limit(10);
    console.log(
      "All offers in database:",
      allOffers.map((o) => ({
        id: o._id,
        sellerId: o.sellerId,
        sellerIdType: typeof o.sellerId,
        requestId: o.requestId,
        title: o.title,
        status: o.status,
      }))
    );

    // Now search for offers by this seller
    // Since sellerId is stored as String in the database, we need to ensure proper comparison
    const query = { sellerId: userId.toString() };
    console.log("Search query:", query);
    console.log("userId.toString():", userId.toString());

    const offers = await SellerOffer.find(query).sort({ createdAt: -1 });

    // Get request details separately since requestId is an ObjectId but no ref
    const requestIds = [...new Set(offers.map((o) => o.requestId))];
    const requests = await BuyerRequest.find(
      { _id: { $in: requestIds } },
      "title make model budgetMin budgetMax"
    );
    const requestMap = {};
    requests.forEach((r) => (requestMap[r._id.toString()] = r));

    // Attach request info to offers
    const offersWithRequests = offers.map((offer) => ({
      ...offer.toObject(),
      requestInfo: requestMap[offer.requestId.toString()] || null,
    }));

    console.log("Found offers for seller:", offersWithRequests.length);
    console.log(
      "Offers data:",
      offersWithRequests.map((o) => ({
        id: o._id,
        sellerId: o.sellerId,
        requestId: o.requestId,
        requestTitle: o.requestInfo?.title || "Unknown",
        title: o.title,
        status: o.status,
      }))
    );

    res.json({ offers: offersWithRequests });
  } catch (error) {
    console.error("Error getting seller offers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getSellerOfferById = async (req, res) => {
  try {
    const { offerId } = req.params;

    console.log("=== GET SELLER OFFER BY ID DEBUG ===");
    console.log("offerId:", offerId);
    console.log("offerId type:", typeof offerId);

    const offer = await SellerOffer.findById(offerId);

    // Get seller details separately since sellerId is a string
    let sellerInfo = null;
    if (offer && offer.sellerId) {
      sellerInfo = await User.findById(
        offer.sellerId,
        "firstName lastName email sellerType companyName"
      );
    }

    // Get car details separately if carId exists
    let carInfo = null;
    if (offer && offer.carId) {
      carInfo = await Car.findById(offer.carId, "make model year images");
    }

    // Get request details separately
    let requestInfo = null;
    if (offer && offer.requestId) {
      requestInfo = await BuyerRequest.findById(
        offer.requestId,
        "title make model budgetMin budgetMax buyerId"
      );
    }

    console.log(
      "Offer lookup result:",
      offer
        ? {
            id: offer._id,
            sellerId: offer.sellerId,
            requestId: offer.requestId,
            title: offer.title,
            status: offer.status,
          }
        : "NOT FOUND"
    );

    if (!offer) {
      return res.status(404).json({ message: "Seller offer not found" });
    }

    // Attach all info to the offer
    const offerWithDetails = {
      ...offer.toObject(),
      sellerInfo,
      carInfo,
      requestInfo,
    };

    res.json({ offer: offerWithDetails });
  } catch (error) {
    console.error("Error getting seller offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateSellerOffer = async (req, res) => {
  try {
    const { userId } = req;
    const { offerId } = req.params;
    const { offerPrice, message, carDetails } = req.body;

    const offer = await SellerOffer.findOne({ _id: offerId, sellerId: userId });
    if (!offer) {
      return res.status(404).json({
        message:
          "Seller offer not found or you are not authorized to update it",
      });
    }

    // Only allow updates if offer is still pending
    if (offer.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Cannot update offer that is not pending" });
    }

    offer.offerPrice = offerPrice || offer.offerPrice;
    offer.message = message || offer.message;
    offer.carDetails = carDetails || offer.carDetails;

    await offer.save();

    res.json({
      message: "Seller offer updated successfully",
      offer,
    });
  } catch (error) {
    console.error("Error updating seller offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteSellerOffer = async (req, res) => {
  try {
    const { userId } = req;
    const { offerId } = req.params;

    const offer = await SellerOffer.findOne({ _id: offerId, sellerId: userId });
    if (!offer) {
      return res.status(404).json({
        message:
          "Seller offer not found or you are not authorized to delete it",
      });
    }

    await SellerOffer.findByIdAndDelete(offerId);

    res.json({
      message: "Seller offer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting seller offer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
