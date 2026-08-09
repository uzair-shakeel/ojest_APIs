const jwt = require("jsonwebtoken");
const { User } = require("../models");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select(
      "-password -phoneVerificationOTP -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    if (user.blocked || user.isBlocked) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message || error);
    res.status(401).json({ message: "Token is not valid" });
  }
};

const admin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  next();
};

const getAuth = (req) => {
  return {
    userId: req.userId,
    user: req.user,
  };
};

module.exports = { auth, admin, getAuth };
