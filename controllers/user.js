// backend/controllers/userController.js
const { User } = require("../models");

// Get all users (Admin route)
exports.getAllUsers = async (req, res) => {
  try {
    const { userId } = req;
    const user = await User.findById(userId);
    // if (!user || user.role !== 'admin') {
    //   return res.status(403).json({ message: 'Access denied. Admins only.' });
    // }

    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req;

    // Users can only get their own profile or admin can get any profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Authenticated user not found" });
    }

    // If requesting own profile, return it
    if (id === userId || user.role === "admin") {
      const targetUser = await User.findById(id).select("-password");
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Add both image fields for compatibility
      const userData = targetUser.toObject();
      userData.image = userData.image || userData.profilePicture;

      return res.json(userData);
    }

    // If not admin and not requesting own profile, return 403
    return res.status(403).json({ message: "Access denied" });
  } catch (error) {
    console.error("Error getting user by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get public user information (no authentication required)
exports.getPublicUserInfo = async (req, res) => {
  try {
    const { id } = req.params;

    // Keep sensitive fields excluded, but allow socialMedia so we can forward safe links
    const user = await User.findById(id).select(
      "-password -email -phoneNumbers -approvalStatus -approvedBy -approvedAt -rejectionReason -role -isBlocked -createdAt -updatedAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return only public information + safe social links
    const publicUserData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      description: user.description,
      sellerType: user.sellerType,
      brands: user.brands,
      image: user.image || user.profilePicture,
      location: user.location,
      rating: user.rating,
      totalSales: user.totalSales,
      memberSince: user.createdAt,
      socialMedia: {
        instagram: user?.socialMedia?.instagram || "",
        facebook: user?.socialMedia?.facebook || "",
        website: user?.socialMedia?.website || "",
      },
    };

    res.json(publicUserData);
  } catch (error) {
    console.error("Error getting public user info:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { userId } = req;
    let updateData = { ...req.body };
    console.log("[updateProfile] ▶ start");
    console.log("[updateProfile] headers:", {
      contentType: req.headers["content-type"],
      auth: req.headers["authorization"] ? "present" : "missing",
    });
    console.log("[updateProfile] userId:", userId);
    console.log("[updateProfile] has req.file:", !!req.file);
    console.log("[updateProfile] has req.files:", Array.isArray(req.files) ? req.files.length : 0);
    if (req.file) {
      console.log("[updateProfile] req.file keys:", Object.keys(req.file));
      console.log("[updateProfile] req.file.path (after Cloudinary):", req.file.path);
      console.log("[updateProfile] req.file.cloudinaryUrl:", req.file.cloudinaryUrl);
      console.log("[updateProfile] req.file.mimetype:", req.file.mimetype);
      console.log("[updateProfile] req.file.size:", req.file.size);
    }
    console.log("[updateProfile] Raw req.body:", req.body);

    // Parse JSON fields that might be stringified
    if (typeof updateData.socialMedia === "string") {
      try {
        updateData.socialMedia = JSON.parse(updateData.socialMedia);
      } catch (e) {
        console.error("[updateProfile] Error parsing socialMedia:", e?.message || e);
      }
    }

    if (typeof updateData.location === "string") {
      try {
        updateData.location = JSON.parse(updateData.location);
      } catch (e) {
        console.error("[updateProfile] Error parsing location:", e?.message || e);
      }
    }

    // Handle phoneNumbers array
    if (updateData.phoneNumbers) {
      // If it's a string, try to parse it
      if (typeof updateData.phoneNumbers === "string") {
        try {
          updateData.phoneNumbers = JSON.parse(updateData.phoneNumbers);
        } catch (e) {
          console.error("[updateProfile] Error parsing phoneNumbers:", e?.message || e);
        }
      }
      // If it's an array of objects with phone property, extract phone values
      if (Array.isArray(updateData.phoneNumbers)) {
        updateData.phoneNumbers = updateData.phoneNumbers
          .map((item) =>
            typeof item === "object" && item.phone ? item.phone : item
          )
          .filter((phone) => phone && phone.trim() !== "");
      }
    }

    // Handle brands array
    if (updateData.brands) {
      if (typeof updateData.brands === "string") {
        try {
          updateData.brands = JSON.parse(updateData.brands);
        } catch (e) {
          console.error("[updateProfile] Error parsing brands:", e?.message || e);
        }
      }
    }
    console.log("[updateProfile] Processed update data:", updateData);

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.email;
    delete updateData.phoneNumber;
    delete updateData.role;
    delete updateData.blocked;

    // Add image if uploaded (prefer Cloudinary URL)
    if (req.file) {
      const secureUrl = req.file.cloudinaryUrl || req.file.path;
      if (secureUrl) {
        updateData.image = secureUrl;
        updateData.profilePicture = secureUrl; // Update both fields
        console.log("[updateProfile] Attached image secureUrl to updateData:", secureUrl);
      } else {
        console.warn("[updateProfile] File present but no secure URL/path found on req.file");
      }
    } else if (updateData.image || updateData.profilePicture) {
      // Accept direct URL strings from body if provided
      const directUrl = updateData.image || updateData.profilePicture;
      if (typeof directUrl === "string" && /^https?:\/\//.test(directUrl)) {
        updateData.image = directUrl;
        updateData.profilePicture = directUrl;
        console.log("[updateProfile] Using direct URL from body for image:", directUrl);
      }
    } else {
      console.log("[updateProfile] No file provided - image fields will not change");
    }

    console.log("[updateProfile] Updating user in DB with:", {
      userId,
      hasImage: !!updateData.image,
      hasProfilePicture: !!updateData.profilePicture,
    });

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add both image fields for compatibility
    const userData = updatedUser.toObject();
    userData.image = userData.image || userData.profilePicture;

    res.json({
      message: "Profile updated successfully",
      user: userData,
    });
    console.log("[updateProfile] ▶ success for user:", userData?._id || userId);
  } catch (error) {
    console.error("[updateProfile] ✖ error:", error?.message || error);
    console.error("[updateProfile] stack:", error?.stack);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user profile custom (for onboarding)
exports.updateProfileCustom = async (req, res) => {
  try {
    const { userId } = req;
    let updateData = { ...req.body };
    console.log("[updateProfileCustom] ▶ start");
    console.log("[updateProfileCustom] headers:", {
      contentType: req.headers["content-type"],
      auth: req.headers["authorization"] ? "present" : "missing",
    });
    console.log("[updateProfileCustom] userId:", userId);
    console.log("[updateProfileCustom] has req.file:", !!req.file);
    console.log("[updateProfileCustom] has req.files:", Array.isArray(req.files) ? req.files.length : 0);
    if (req.file) {
      console.log("[updateProfileCustom] req.file.path (after Cloudinary):", req.file.path);
      console.log("[updateProfileCustom] req.file.cloudinaryUrl:", req.file.cloudinaryUrl);
    }
    console.log("[updateProfileCustom] Raw req.body:", req.body);
    console.log("[updateProfileCustom] sellerType in body:", req.body.sellerType);

    // Parse JSON fields that might be stringified
    if (typeof updateData.socialMedia === "string") {
      try {
        updateData.socialMedia = JSON.parse(updateData.socialMedia);
      } catch (e) {
        console.error("[updateProfileCustom] Error parsing socialMedia:", e?.message || e);
      }
    }

    if (typeof updateData.location === "string") {
      try {
        updateData.location = JSON.parse(updateData.location);
      } catch (e) {
        console.error("[updateProfileCustom] Error parsing location:", e?.message || e);
      }
    }

    if (typeof updateData.phoneNumbers === "string") {
      try {
        updateData.phoneNumbers = JSON.parse(updateData.phoneNumbers);
      } catch (e) {
        console.error("[updateProfileCustom] Error parsing phoneNumbers:", e?.message || e);
      }
    }
    if (Array.isArray(updateData.phoneNumbers)) {
      updateData.phoneNumbers = updateData.phoneNumbers
        .map((item) =>
          typeof item === "object" && item.phone ? item.phone : item
        )
        .filter((phone) => phone && String(phone).trim() !== "");
    }

    if (typeof updateData.brands === "string") {
      try {
        updateData.brands = JSON.parse(updateData.brands);
      } catch (e) {
        console.error("[updateProfileCustom] Error parsing brands:", e?.message || e);
      }
    }

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.blocked;

    console.log("[updateProfileCustom] Final updateData:", updateData);

    // Add image if uploaded (prefer Cloudinary URL)
    if (req.file) {
      const secureUrl = req.file.cloudinaryUrl || req.file.path;
      if (secureUrl) {
        updateData.image = secureUrl;
        updateData.profilePicture = secureUrl; // Update both fields
        console.log("[updateProfileCustom] Attached image secureUrl:", secureUrl);
      } else {
        console.warn("[updateProfileCustom] File present but no secure URL/path found on req.file");
      }
    } else if (updateData.image || updateData.profilePicture) {
      // Accept direct URL strings from body if provided
      const directUrl = updateData.image || updateData.profilePicture;
      if (typeof directUrl === "string" && /^https?:\/\//.test(directUrl)) {
        updateData.image = directUrl;
        updateData.profilePicture = directUrl;
        console.log("[updateProfileCustom] Using direct URL from body for image:", directUrl);
      }
    } else {
      console.log("[updateProfileCustom] No file provided - image fields unchanged");
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add both image fields for compatibility
    const userData = updatedUser.toObject();
    userData.image = userData.image || userData.profilePicture;

    res.json({
      message: "Profile updated successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update seller type
exports.updateSellerType = async (req, res) => {
  try {
    const { id } = req.params;
    const { sellerType, brands } = req.body;

    const updateData = { sellerType };
    if (brands) {
      updateData.brands = brands;
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Seller type updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating seller type:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete user account
exports.deleteAccount = async (req, res) => {
  try {
    const { userId } = req;

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin functions
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const privateSellers = await User.countDocuments({ sellerType: "private" });
    const companySellers = await User.countDocuments({ sellerType: "company" });
    const blockedUsers = await User.countDocuments({ blocked: true });
    const pendingUsers = await User.countDocuments({
      approvalStatus: "pending",
    });
    const approvedUsers = await User.countDocuments({
      approvalStatus: "approved",
    });
    const rejectedUsers = await User.countDocuments({
      approvalStatus: "rejected",
    });

    res.json({
      totalUsers,
      privateSellers,
      companySellers,
      blockedUsers,
      pendingUsers,
      approvedUsers,
      rejectedUsers,
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUsersForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      sellerType = "",
      blocked = "",
      approvalStatus = "",
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (sellerType) {
      query.sellerType = sellerType;
    }

    if (blocked !== "") {
      query.blocked = blocked === "true";
    }

    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Error getting users for admin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.toggleUserBlock = async (req, res) => {
  try {
    const { targetUserId } = req.params;

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.blocked = !user.blocked;
    await user.save();

    res.json({
      message: `User ${user.blocked ? "blocked" : "unblocked"} successfully`,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        blocked: user.blocked,
      },
    });
  } catch (error) {
    console.error("Error toggling user block:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error changing user role:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;

    const deletedUser = await User.findByIdAndDelete(targetUserId);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Approve user registration
exports.approveUser = async (req, res) => {
  console.log("approveUser - req.body:", req.body);
  try {
    const { targetUserId } = req.params;
    const { userId } = req;

    console.log("approveUser - targetUserId:", targetUserId);
    console.log("approveUser - userId:", userId);

    // Check if admin is approving
    const adminUser = await User.findById(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      {
        approvalStatus: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
      },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User approved successfully",
      user,
    });
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Reject user registration
exports.rejectUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { rejectionReason } = req.body;
    const { userId } = req;

    // Check if admin is rejecting
    const adminUser = await User.findById(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      {
        approvalStatus: "rejected",
        rejectionReason: rejectionReason || "No reason provided",
        approvedBy: userId,
        approvedAt: new Date(),
      },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User rejected successfully",
      user,
    });
  } catch (error) {
    console.error("Error rejecting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user approval statistics
exports.getUserApprovalStats = async (req, res) => {
  try {
    const { userId } = req;

    // Check if admin
    const adminUser = await User.findById(userId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const stats = await User.aggregate([
      {
        $group: {
          _id: "$approvalStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    res.json(formattedStats);
  } catch (error) {
    console.error("Error getting user approval stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Simple approval status update - NO AUTH REQUIRED for testing
exports.updateUserApprovalStatus = async (req, res) => {
  // Add a simple test log to see if the function is even being called
  console.log("🎯 FUNCTION CALLED: updateUserApprovalStatus");
  console.log("⏰ Timestamp:", new Date().toISOString());
  try {
    console.log("🚀 === APPROVAL STATUS UPDATE STARTED ===");
    console.log("📝 Request body:", req.body);
    console.log("🔗 Request params:", req.params);
    console.log("📧 Request headers:", req.headers);

    const { userId } = req.params;
    const { status } = req.body;

    console.log("🎯 Extracted data:", { userId, status });

    // Validate status
    console.log("✅ Status validation:", status);
    if (!["pending", "approved", "rejected"].includes(status)) {
      console.log("❌ Invalid status:", status);
      return res.status(400).json({
        message: "Invalid status. Must be: pending, approved, or rejected",
      });
    }
    console.log("✅ Status is valid:", status);

    // Update user status
    console.log("🔄 Attempting to update user in database...");
    console.log("🔍 Looking for user with ID:", userId);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        approvalStatus: status,
        updatedAt: new Date(),
      },
      { new: true }
    ).select("-password");

    console.log(
      "📊 Database update result:",
      user ? "User found and updated" : "User not found"
    );

    if (!user) {
      console.log("❌ User not found with ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log(
      "✅ User status updated successfully:",
      user.email,
      "->",
      status
    );
    console.log("👤 Updated user details:", {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      approvalStatus: user.approvalStatus,
    });

    console.log("📤 Sending success response...");
    res.json({
      message: "User approval status updated successfully",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        approvalStatus: user.approvalStatus,
      },
    });
    console.log("✅ === APPROVAL STATUS UPDATE COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("❌ === APPROVAL STATUS UPDATE FAILED ===");
    console.error("🚨 Error details:", error);
    console.error("📋 Error message:", error.message);
    console.error("🔍 Error stack:", error.stack);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      details: "Check server console for more information",
    });
  }
};

// Admin endpoints

// Get user statistics for admin dashboard
exports.getUserStats = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    // Total users
    const totalUsers = await User.countDocuments();

    // Active users (not blocked)
    const activeUsers = await User.countDocuments({ blocked: false });

    // Blocked users
    const blockedUsers = await User.countDocuments({ blocked: true });

    // Users by seller type
    const usersBySellerType = await User.aggregate([
      {
        $group: {
          _id: "$sellerType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // New users per month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const newUsersPerMonth = await User.aggregate([
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

    res.json({
      totalUsers,
      activeUsers,
      blockedUsers,
      usersBySellerType,
      usersByRole,
      newUsersPerMonth,
    });
  } catch (error) {
    console.error("Error getting user stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all users for admin with pagination and filtering
exports.getAllUsersForAdmin = async (req, res) => {
  try {
    // Remove admin check for now - direct access

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.sellerType) filter.sellerType = req.query.sellerType;
    if (req.query.blocked !== undefined)
      filter.blocked = req.query.blocked === "true";
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: "i" } },
        { lastName: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
        { companyName: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v");

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  } catch (error) {
    console.error("Error getting users for admin:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to block/unblock user
exports.toggleUserBlock = async (req, res) => {
  try {
    const { targetUserId } = req.params;

    // Remove admin check for now - direct access

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Don't allow blocking other admins
    if (targetUser.role === "admin") {
      return res.status(403).json({ message: "Cannot block admin users" });
    }

    targetUser.blocked = !targetUser.blocked;
    await targetUser.save();

    res.json({
      message: `User ${
        targetUser.blocked ? "blocked" : "unblocked"
      } successfully`,
      user: targetUser,
    });
  } catch (error) {
    console.error("Error toggling user block:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to change user role
exports.changeUserRole = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { role } = req.body;

    // Remove admin check for now - direct access

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    targetUser.role = role;
    await targetUser.save();

    res.json({
      message: "User role updated successfully",
      user: targetUser,
    });
  } catch (error) {
    console.error("Error changing user role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin function to delete user
exports.deleteUser = async (req, res) => {
  try {
    const { targetUserId } = req.params;

    // Remove admin check for now - direct access

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Don't allow deleting other admins
    if (targetUser.role === "admin") {
      return res.status(403).json({ message: "Cannot delete admin users" });
    }

    // Delete user from database
    await User.findByIdAndDelete(targetUserId);

    res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
