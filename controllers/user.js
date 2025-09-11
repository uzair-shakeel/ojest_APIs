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

    const user = await User.findById(id).select(
      "-password -email -phoneNumbers -socialMedia -approvalStatus -approvedBy -approvedAt -rejectionReason -role -isBlocked -createdAt -updatedAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return only public information
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

    console.log("Raw update data:", req.body);

    // Parse JSON fields that might be stringified
    if (typeof updateData.socialMedia === "string") {
      try {
        updateData.socialMedia = JSON.parse(updateData.socialMedia);
      } catch (e) {
        console.error("Error parsing socialMedia:", e);
      }
    }

    if (typeof updateData.location === "string") {
      try {
        updateData.location = JSON.parse(updateData.location);
      } catch (e) {
        console.error("Error parsing location:", e);
      }
    }

    // Handle phoneNumbers array
    if (updateData.phoneNumbers) {
      // If it's a string, try to parse it
      if (typeof updateData.phoneNumbers === "string") {
        try {
          updateData.phoneNumbers = JSON.parse(updateData.phoneNumbers);
        } catch (e) {
          console.error("Error parsing phoneNumbers:", e);
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
          console.error("Error parsing brands:", e);
        }
      }
    }

    console.log("Processed update data:", updateData);

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.email;
    delete updateData.phoneNumber;
    delete updateData.role;
    delete updateData.blocked;

    // Add image if uploaded
    if (req.file) {
      updateData.image = req.file.path;
      updateData.profilePicture = req.file.path; // Update both fields
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

// Update user profile custom (for onboarding)
exports.updateProfileCustom = async (req, res) => {
  try {
    const { userId } = req;
    let updateData = { ...req.body };

    console.log("updateProfileCustom - Raw req.body:", req.body);
    console.log("updateProfileCustom - userId:", userId);
    console.log(
      "updateProfileCustom - sellerType in body:",
      req.body.sellerType
    );

    // Parse JSON fields that might be stringified
    if (typeof updateData.socialMedia === "string") {
      try {
        updateData.socialMedia = JSON.parse(updateData.socialMedia);
      } catch (e) {
        console.error("Error parsing socialMedia (custom):", e);
      }
    }

    if (typeof updateData.location === "string") {
      try {
        updateData.location = JSON.parse(updateData.location);
      } catch (e) {
        console.error("Error parsing location (custom):", e);
      }
    }

    if (typeof updateData.phoneNumbers === "string") {
      try {
        updateData.phoneNumbers = JSON.parse(updateData.phoneNumbers);
      } catch (e) {
        console.error("Error parsing phoneNumbers (custom):", e);
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
        console.error("Error parsing brands (custom):", e);
      }
    }

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.blocked;

    console.log("updateProfileCustom - Final updateData:", updateData);

    // Add image if uploaded
    if (req.file) {
      updateData.image = req.file.path;
      updateData.profilePicture = req.file.path; // Update both fields
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
