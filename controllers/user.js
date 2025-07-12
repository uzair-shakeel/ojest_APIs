// backend/controllers/userController.js
const { User } = require("../models");
const { clerkClient } = require("@clerk/clerk-sdk-node");
// const clerk = new ClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// New syncUser function
exports.syncUser = async (req, res) => {
  try {
    const { user } = req.body;
    console.log("Sync User Request:", user);
    const userId = user.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch user from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);

    // Extract email from Clerk's emailAddresses
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!email) {
      return res.status(400).json({ error: "Email not found for user" });
    }

    // Upsert user in MongoDB
    const updatedUser = await User.findOneAndUpdate(
      { clerkUserId: userId },
      {
        clerkUserId: userId,
        email,
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        sellerType: "private", // Default seller type
        image: clerkUser.profileImageUrl || "",
        phoneNumbers: [],
        socialMedia: {
          instagram: "",
          facebook: "",
          twitter: "",
          website: "",
          linkedin: "",
        },
        description: "",
        companyName: "",
        role: "user",
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
        updatedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log("User synced to MongoDB:", updatedUser);
    res.status(201).json({
      message: "User synced successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error syncing user:", error);

    // Check if it's a duplicate key error
    if (error.code === 11000) {
      const keyPattern = error.keyPattern;
      const keyValue = error.keyValue;
      const fieldName = Object.keys(keyPattern)[0];

      return res.status(400).json({
        error: `Duplicate key error on field '${fieldName}' with value '${JSON.stringify(
          keyValue[fieldName]
        )}'`,
        details: error.message,
      });
    }

    res.status(500).json({
      error: "Failed to sync user",
      details: error.message,
    });
  }
};
// Get all users (Admin route)
exports.getAllUsers = async (req, res) => {
  try {
    const { userId } = req.auth;
    const user = await User.findOne({ clerkUserId: userId });
    // if (!user || user.role !== 'admin') {
    //   return res.status(403).json({ message: 'Access denied. Admins only.' });
    // }

    const users = await User.find();
    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get user by Clerk userId (Public profile)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params; // This is now clerkUserId
    const user = await User.findOne({ clerkUserId: id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const clerkUser = await clerkClient.users.getUser(id);
    const response = {
      clerkUserId: user.clerkUserId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      socialMedia: user.socialMedia,
      phoneNumbers: user.phoneNumbers,
      location: user.location,
      image: user.image,
      description: user.description,
      companyName: user.companyName,
      role: user.role,
      sellerType: user.sellerType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      clerkData: {
        profileImage: clerkUser.profileImageUrl || user.image,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Get User By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update user profile (Normal user)
exports.updateProfile = async (req, res) => {
  try {
    console.log("Update Profile Request Body:", req.body);
    console.log("Update Profile Auth:", req.auth);

    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "No user ID provided in auth" });
    }

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    const {
      firstName,
      lastName,
      sellerType,
      socialMedia,
      phoneNumbers,
      location,
      description,
      companyName,
    } = req.body;

    console.log("Extracted data:", {
      firstName,
      lastName,
      sellerType,
      socialMedia:
        typeof socialMedia === "string" ? "JSON string" : socialMedia,
      phoneNumbers:
        typeof phoneNumbers === "string" ? "JSON string" : phoneNumbers,
      location: typeof location === "string" ? "JSON string" : location,
      description,
      companyName,
    });

    if (sellerType && !["private", "company"].includes(sellerType)) {
      return res
        .status(400)
        .json({ error: 'Invalid sellerType. Must be "private" or "company".' });
    }

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (sellerType) updateData.sellerType = sellerType;

    // Handle socialMedia
    if (socialMedia) {
      try {
        updateData.socialMedia =
          typeof socialMedia === "string"
            ? JSON.parse(socialMedia)
            : socialMedia;
      } catch (err) {
        console.error("Error parsing socialMedia:", err);
        return res.status(400).json({ error: "Invalid socialMedia format" });
      }
    }

    // Handle phoneNumbers
    if (phoneNumbers) {
      try {
        // If phoneNumbers is a string, parse it
        const parsedPhoneNumbers =
          typeof phoneNumbers === "string"
            ? JSON.parse(phoneNumbers)
            : phoneNumbers;

        // Ensure it's an array
        if (Array.isArray(parsedPhoneNumbers)) {
          updateData.phoneNumbers = parsedPhoneNumbers;
        } else {
          console.error("phoneNumbers is not an array:", parsedPhoneNumbers);
          return res
            .status(400)
            .json({ error: "phoneNumbers must be an array" });
        }
      } catch (err) {
        console.error("Error parsing phoneNumbers:", err);
        return res.status(400).json({ error: "Invalid phoneNumbers format" });
      }
    }

    if (description) updateData.description = description;
    if (companyName) updateData.companyName = companyName;
    if (req.file) updateData.image = req.file.cloudinaryUrl;

    // Validate location
    if (location) {
      try {
        const parsedLocation =
          typeof location === "string" ? JSON.parse(location) : location;
        if (
          parsedLocation.type === "Point" &&
          Array.isArray(parsedLocation.coordinates) &&
          parsedLocation.coordinates.length === 2 &&
          typeof parsedLocation.coordinates[1] === "number" &&
          typeof parsedLocation.coordinates[0] === "number" &&
          !isNaN(parsedLocation.coordinates[1]) &&
          !isNaN(parsedLocation.coordinates[0])
        ) {
          updateData.location = {
            type: "Point",
            coordinates: parsedLocation.coordinates,
          };
        } else {
          console.error("Invalid location format:", parsedLocation);
          return res.status(400).json({
            error:
              'Invalid location. Must be an object { type: "Point", coordinates: [longitude, latitude] }.',
          });
        }
      } catch (err) {
        console.error("Error parsing location:", err);
        return res.status(400).json({ error: "Invalid location format" });
      }
    }

    updateData.updatedAt = new Date();

    console.log("Final update data:", updateData);

    const updatedUser = await User.findOneAndUpdate(
      { clerkUserId: userId },
      { $set: updateData },
      { new: true }
    );

    console.log("Updated user:", updatedUser);

    // Update Clerk's public_metadata
    const metadata = {
      sellerType: updatedUser.sellerType,
      phoneNumbers: updatedUser.phoneNumbers,
      socialMedia: updatedUser.socialMedia,
      location: updatedUser.location,
      description: updatedUser.description,
      companyName: updatedUser.companyName,
      role: updatedUser.role,
    };
    await clerkClient.users.updateUser(userId, { publicMetadata: metadata });

    res.json(updatedUser);
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//update user seller type
exports.updateSellerType = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { sellerType } = req.body;

    if (!sellerType || !["private", "company"].includes(sellerType)) {
      return res.status(400).json({ message: "Invalid seller type" });
    }

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.sellerType = sellerType;
    await user.save();

    // Update Clerk's public_metadata
    const metadata = {
      sellerType: user.sellerType,
    };
    await clerkClient.users.updateUser(userId, { publicMetadata: metadata });

    res.json(user);
  } catch (error) {
    console.error("Update Seller Type Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// New function for SellerDetailsPage
exports.updateProfileCustom = async (req, res) => {
  try {
    const { userId } = req.auth;
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    const {
      firstName,
      lastName,
      email,
      companyName,
      phoneNumbers,
      description,
      socialMedia,
      sellerType,
    } = req.body;

    // Validate sellerType
    if (sellerType && !["private", "company"].includes(sellerType)) {
      return res
        .status(400)
        .json({ error: 'Invalid sellerType. Must be "private" or "company".' });
    }

    // Validate phoneNumbers format
    if (phoneNumbers) {
      const parsedPhoneNumbers =
        typeof phoneNumbers === "string"
          ? JSON.parse(phoneNumbers)
          : phoneNumbers;
      if (
        !Array.isArray(parsedPhoneNumbers) ||
        !parsedPhoneNumbers.every((p) => p.phone && typeof p.phone === "string")
      ) {
        return res.status(400).json({
          error:
            "Invalid phoneNumbers. Must be an array of objects with 'phone' property.",
        });
      }
    }

    // Validate socialMedia format
    if (socialMedia) {
      const parsedSocialMedia =
        typeof socialMedia === "string" ? JSON.parse(socialMedia) : socialMedia;
      if (
        !parsedSocialMedia ||
        typeof parsedSocialMedia !== "object" ||
        !["instagram", "facebook", "twitter", "website", "linkedin"].every(
          (key) =>
            typeof parsedSocialMedia[key] === "string" ||
            parsedSocialMedia[key] === undefined
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid socialMedia. Must be an object with optional keys: instagram, facebook, twitter, website, linkedin.",
        });
      }
    }

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email; // Update email if provided
    if (companyName) updateData.companyName = companyName;
    if (phoneNumbers) updateData.phoneNumbers = phoneNumbers;
    if (description) updateData.description = description;
    if (socialMedia) updateData.socialMedia = socialMedia;
    if (sellerType) updateData.sellerType = sellerType;
    if (req.file) updateData.image = req.file.cloudinaryUrl;

    updateData.updatedAt = new Date();

    const updatedUser = await User.findOneAndUpdate(
      { clerkUserId: userId },
      { $set: updateData },
      { new: true }
    );

    // Update Clerk's public_metadata
    const metadata = {
      sellerType: updatedUser.sellerType,
      phoneNumbers: updatedUser.phoneNumbers,
      socialMedia: updatedUser.socialMedia,
      description: updatedUser.description,
      companyName: updatedUser.companyName,
      role: updatedUser.role,
    };
    await clerkClient.users.updateUser(userId, { publicMetadata: metadata });

    res.json(updatedUser);
  } catch (error) {
    console.error("Update Profile Custom Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// Delete user account
exports.deleteAccount = async (req, res) => {
  try {
    const { userId } = req.auth;

    // Delete user from MongoDB
    const user = await User.findOneAndDelete({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user from Clerk
    await clerkClient.users.deleteUser(userId);

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete Account Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
