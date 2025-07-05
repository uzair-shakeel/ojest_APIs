const express = require("express");
const router = express.Router();
const { clerkAuth } = require("../middlewares/clerkAuth");
const {
  createChat,
  getUserChats,
  getChatMessages,
} = require("../controllers/chat");

// Debug route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes are working" });
});

// Routes
router.post("/create", clerkAuth, createChat);
router.get("/my-chats", clerkAuth, getUserChats);
router.get("/:chatId/messages", clerkAuth, getChatMessages);

module.exports = router;
