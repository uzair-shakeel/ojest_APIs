const express = require("express");
const router = express.Router();
const {
  createChat,
  getUserChats,
  getChatMessages,
} = require("../controllers/chat");

// Middleware to verify Clerk user with debugging
const verifyUser = (req, res, next) => {
  console.log("Headers received:", req.headers);
  const userId = req.headers["x-clerk-user-id"]; // Adjust based on Clerk's header
  console.log("User ID from header:", userId);

  // TEMPORARY: Allow requests without authentication for testing
  if (!userId) {
    console.log("WARNING: No user ID found, using test ID");
    req.userId = "test-user-id"; // Use a test ID temporarily
    return next();
  }

  req.userId = userId;
  next();
};

// Routes
router.post("/create", verifyUser, createChat);
router.get("/my-chats", verifyUser, getUserChats);
router.get("/:chatId/messages", verifyUser, getChatMessages);

module.exports = router;
