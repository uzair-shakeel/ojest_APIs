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
      brands: user.brands || [], // Add brands to the response
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
    console.log(
      "Update Profile Request Body (RAW):",
      JSON.stringify(req.body, null, 2)
    );
    console.log("Update Profile Auth:", JSON.stringify(req.auth, null, 2));

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
      brands,
    } = req.body;

    console.log("Received Data:", {
      sellerType,
      brands: brands ? JSON.stringify(brands) : null,
      socialMedia: socialMedia ? JSON.stringify(socialMedia) : null,
      phoneNumbers: phoneNumbers ? JSON.stringify(phoneNumbers) : null,
    });

    const updateData = {};

    // Validate and set seller type
    if (sellerType) {
      if (!["private", "company"].includes(sellerType)) {
        return res.status(400).json({
          error: 'Invalid seller type. Must be "private" or "company".',
        });
      }
      updateData.sellerType = sellerType;
    }

    // Handle brands for company sellers
    if (sellerType === "company") {
      if (!brands || !Array.isArray(brands) || brands.length === 0) {
        return res.status(400).json({
          error: "Company sellers must specify at least one brand.",
        });
      }
      updateData.brands = brands;
    }

    // Optional fields
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (description) updateData.description = description;
    if (companyName) updateData.companyName = companyName;

    // Handle social media
    if (socialMedia) {
      try {
        // Parse if it's a string, otherwise use as-is
        const parsedSocialMedia =
          typeof socialMedia === "string"
            ? JSON.parse(socialMedia)
            : socialMedia;

        updateData.socialMedia = parsedSocialMedia;
      } catch (err) {
        return res.status(400).json({ error: "Invalid social media format" });
      }
    }

    // Handle phone numbers
    if (phoneNumbers) {
      try {
        // Parse if it's a string, otherwise use as-is
        const parsedPhoneNumbers =
          typeof phoneNumbers === "string"
            ? JSON.parse(phoneNumbers)
            : phoneNumbers;

        if (!Array.isArray(parsedPhoneNumbers)) {
          return res
            .status(400)
            .json({ error: "Phone numbers must be an array" });
        }

        updateData.phoneNumbers = parsedPhoneNumbers;
      } catch (err) {
        return res.status(400).json({ error: "Invalid phone numbers format" });
      }
    }

    // Handle location
    if (location) {
      try {
        // Parse if it's a string, otherwise use as-is
        const parsedLocation =
          typeof location === "string" ? JSON.parse(location) : location;

        if (
          parsedLocation.type !== "Point" ||
          !Array.isArray(parsedLocation.coordinates) ||
          parsedLocation.coordinates.length !== 2
        ) {
          return res.status(400).json({ error: "Invalid location format" });
        }

        updateData.location = parsedLocation;
      } catch (err) {
        return res.status(400).json({ error: "Invalid location format" });
      }
    }

    // Add image if uploaded
    if (req.file) {
      // Validate image file
      const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error:
            "Invalid image type. Only JPEG, PNG, WebP, and GIF are allowed.",
        });
      }

      // Optional: Add file size limit (e.g., 5MB)
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxFileSize) {
        return res.status(400).json({
          error: "Image file is too large. Maximum size is 5MB.",
        });
      }

      updateData.image = req.file.cloudinaryUrl;

      // Optional: Update Clerk's profile image
      try {
        await clerkClient.users.updateUser(userId, {
          profileImage: req.file.cloudinaryUrl,
        });
      } catch (clerkUpdateError) {
        console.warn("Failed to update Clerk profile image:", clerkUpdateError);
        // Continue with the update even if Clerk update fails
      }
    }

    console.log("Final Update Data:", JSON.stringify(updateData, null, 2));

    const updatedUser = await User.findOneAndUpdate(
      { clerkUserId: userId },
      { $set: updateData },
      { new: true }
    );

    console.log("Updated User:", JSON.stringify(updatedUser, null, 2));

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
