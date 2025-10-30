const express = require("express");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const crypto = require("crypto");
const { auth } = require("../middlewares/auth");
const { validatePhoneNumber, sendOTP } = require("../utils/otpService");
const {
  ComplianceRegistrationInquiriesContextImpl,
} = require("twilio/lib/rest/trusthub/v1/complianceRegistrationInquiries");
const router = express.Router();

// Test endpoint
router.get("/test", (req, res) => {
  res.json({
    message: "Auth API is working!",
    timestamp: new Date().toISOString(),
  });
});

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    {
      userId,
      sessionId: Date.now().toString(),
    },
    process.env.JWT_SECRET || "your-secret-key-development",
    { expiresIn: "100y" }
  );
};


// For development/testing - show OTP in console and alert
const logOTP = (contact, otp, type = "phone") => {
  console.log(`OTP for ${type} ${contact}: ${otp}`);
  return otp;
};

router.post("/signup", async (req, res) => {
  try {
    const { email, phoneNumber, password, firstName, lastName, termsAccepted, termsVersion } = req.body;

    console.log("Input:", {
      email,
      phoneNumber,
      password,
      firstName,
      lastName,
    });

    // Validate input
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json({ message: "Email or phone number is required" });
    }
    if (email && typeof email !== "string") {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Require Terms & Conditions acceptance
    if (!termsAccepted) {
      return res.status(400).json({ message: "You must accept the Terms & Conditions" });
    }

    // Validate phone number if provided
    if (phoneNumber) {
      if (typeof phoneNumber !== "string" || phoneNumber.trim() === "") {
        return res.status(400).json({ message: "Invalid phone number" });
      }
      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.isValid) {
        return res.status(400).json({ message: phoneValidation.error });
      }
    }

    // Build query for existing user
    const queryConditions = [];
    if (email) {
      queryConditions.push({ email: email.toLowerCase() });
    }
    if (phoneNumber && phoneNumber.trim()) {
      queryConditions.push({
        phoneNumber: validatePhoneNumber(phoneNumber).formattedNumber,
      });
    }

    const existingUser = await User.findOne(
      queryConditions.length > 0 ? { $or: queryConditions } : {}
    );

    console.log("Query conditions:", queryConditions);
    console.log("Existing user:", existingUser);

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email or phone number",
      });
    }

    // Create new user (do not save yet)
    const user = new User({
      email: email ? email.toLowerCase() : undefined,
      phoneNumber: phoneNumber
        ? validatePhoneNumber(phoneNumber).formattedNumber
        : undefined,
      password,
      firstName: firstName || "",
      lastName: lastName || "",
      isEmailVerified: false,
      isPhoneVerified: false,
      approvalStatus: "pending", // New users start as pending
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      termsVersion: termsVersion || "v1",
    });

    console.log("New user:", user);

    // Generate OTP (save only after OTP delivery succeeds)
    const otp = user.generateOTP();

    // Send OTP
    try {
      if (phoneNumber) {
        if (process.env.NODE_ENV === "development") {
          const loggedOTP = logOTP(phoneNumber, otp, "phone");
          await user.save();
          return res.status(201).json({
            message: "User created successfully. OTP sent for verification.",
            userId: user._id,
            requiresOTP: true,
            otp: loggedOTP, // Remove this in production
            contactType: "phone",
          });
        } else {
          await sendOTP(phoneNumber, otp, "phone");
          await user.save();
          return res.status(201).json({
            message: "User created successfully. OTP sent for verification.",
            userId: user._id,
            requiresOTP: true,
            contactType: "phone",
          });
        }
      } else if (email) {
        await sendOTP(email, otp, "email");
        await user.save();
        return res.status(201).json({
          message: "User created successfully. OTP sent for verification.",
          userId: user._id,
          requiresOTP: true,
          contactType: "email",
        });
      }
    } catch (error) {
      console.error("OTP sending error:", error);
      // Do not save user if OTP could not be sent in production
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "User ID and OTP are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verifyOTP(otp)) {
      // Mark the appropriate verification based on what the user has
      if (user.phoneNumber && !user.isPhoneVerified) {
        user.isPhoneVerified = true;
      }
      if (user.email && !user.isEmailVerified) {
        user.isEmailVerified = true;
      }

      user.phoneVerificationOTP = undefined;
      user.otpExpiry = undefined;
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.json({
        message: "Verification successful",
        token,
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
      });
    } else {
      res.status(400).json({ message: "Invalid or expired OTP" });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.phoneNumber && !user.email) {
      return res.status(400).json({
        message: "No contact information associated with this account",
      });
    }

    const otp = user.generateOTP();
    await user.save();

    // Send OTP
    try {
      if (user.phoneNumber) {
        // For development, log OTP and show in alert
        if (process.env.NODE_ENV === "development") {
          const loggedOTP = logOTP(user.phoneNumber, otp, "phone");
          res.json({
            message: "OTP resent successfully",
            otp: loggedOTP, // Remove this in production
            contactType: "phone",
          });
        } else {
          // For production, send actual SMS
          await sendOTP(user.phoneNumber, otp, "phone");
          res.json({
            message: "OTP resent successfully",
            contactType: "phone",
          });
        }
      } else if (user.email) {
        // For development, log OTP and show in alert
        if (process.env.NODE_ENV === "development") {
          const loggedOTP = logOTP(user.email, otp, "email");
          res.json({
            message: "OTP resent successfully",
            otp: loggedOTP, // Remove this in production
            contactType: "email",
          });
        } else {
          // For production, send actual email
          await sendOTP(user.email, otp, "email");
          res.json({
            message: "OTP resent successfully",
            contactType: "email",
          });
        }
      }
    } catch (error) {
      console.error("OTP resend error:", error);
      res
        .status(500)
        .json({ message: "Failed to resend OTP. Please try again." });
    }
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Sign in
router.post("/signin", async (req, res) => {
  try {
    const { email, phoneNumber, password } = req.body;

    console.log("Signin attempt:", {
      email,
      phoneNumber,
      hasPassword: !!password,
    });
    // Validate input
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json({ message: "Email or phone number is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Build query based on provided credentials
    let query = {};
    if (email) {
      query.email = email.toLowerCase();
    } else if (phoneNumber) {
      query.phoneNumber = phoneNumber;
    }

    console.log("Searching with query:", query);

    // Find user
    const user = await User.findOne(query);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("User found:", {
      id: user._id,
      hasPassword: !!user.password,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    // Check if user has a password (for Google OAuth users)
    if (!user.password) {
      return res.status(401).json({
        message:
          "This account was created with Google. Please sign in with Google.",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: "Sign in successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Google OAuth with ID Token verification
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google ID token is required" });
    }

    // Verify the Google ID token
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      console.error("Google token verification failed:", error);
      return res.status(400).json({ message: "Invalid Google token" });
    }

    const payload = ticket.getPayload();
    const {
      sub: googleId,
      email,
      given_name: firstName,
      family_name: lastName,
      picture: image,
    } = payload;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email not found in Google token" });
    }

    // Check if user exists with Google ID
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists with email
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        user.authProvider = "google";
        user.profilePicture = image || user.profilePicture;
        user.isEmailVerified = true;
        await user.save();
      } else {
        // Create new user
        user = new User({
          googleId,
          email: email.toLowerCase(),
          firstName: firstName || "",
          lastName: lastName || "",
          profilePicture: image || "",
          authProvider: "google",
          isEmailVerified: true,
          isPhoneVerified: false,
        });
        await user.save();
      }
    }

    if (user.blocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: "Google authentication successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
        image: user.image || user.profilePicture, // Include both for compatibility
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user
router.get("/me", auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        image: req.user.image || req.user.profilePicture, // Include both for compatibility
        profilePicture: req.user.profilePicture,
        isEmailVerified: req.user.isEmailVerified,
        isPhoneVerified: req.user.isPhoneVerified,
        sellerType: req.user.sellerType,
        role: req.user.role,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

// Password reset and change endpoints
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    // For security, do not reveal if user exists
    if (!user) return res.json({ message: "If the email exists, a reset link was sent" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    try {
      const { sendPasswordResetEmail } = require("../utils/otpService");
      await sendPasswordResetEmail(user.email, token);
    } catch (e) {
      console.error("Failed to send reset email:", e?.message || e);
    }

    res.json({ message: "If the email exists, a reset link was sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    // Force local provider so pre-save hook will hash password
    user.authProvider = "local";
    user.password = newPassword; // will be hashed by pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

    // Force local provider so pre-save hook will hash password
    user.authProvider = "local";
    user.password = newPassword; // will be hashed by pre-save hook
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
