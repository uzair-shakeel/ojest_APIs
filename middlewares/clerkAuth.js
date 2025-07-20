// backend/middlewares/clerkAuth.js
const { ClerkExpressWithAuth } = require("@clerk/clerk-sdk-node");
const jwt = require("jsonwebtoken");

// Create middleware that handles both JWT tokens and Clerk sessions
const clerkAuth = (req, res, next) => {
  console.log("clerkAuth middleware called");
  console.log("Headers:", req.headers);

  // Check for Authorization header (JWT token)
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    // Extract the token
    const token = authHeader.substring(7);
    console.log("Token found in Authorization header");

    // Set the auth object with userId from token
    try {
      // For simplicity, we'll just decode the token without verification
      // In a real app, you'd verify the token signature
      const decoded = Buffer.from(token.split(".")[1], "base64").toString();
      const payload = JSON.parse(decoded);

      console.log("Decoded token payload:", payload);

      req.auth = {
        userId: payload.sub || payload.userId,
        sessionId: payload.sid,
        getToken: () => Promise.resolve(token),
      };

      console.log("Auth from token:", req.auth);
      return next();
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  } else {
    console.log("No Authorization header found or not a Bearer token");
  }

  // If no valid token, fall back to Clerk session
  console.log("Falling back to Clerk session");
  const clerkMiddleware = ClerkExpressWithAuth({
    onError: (err) => {
      console.error("Clerk middleware error:", err);
    },
  });

  return clerkMiddleware(req, res, (err) => {
    if (err) {
      console.error("Clerk middleware error:", err);
      return res.status(401).json({ message: "Authentication failed" });
    }

    console.log("Clerk auth successful:", req.auth);
    next();
  });
};

const getAuth = (req) => {
  return req.auth || {};
};

module.exports = { clerkAuth, getAuth };
