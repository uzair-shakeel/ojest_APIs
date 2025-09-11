const express = require("express");
const { auth } = require("../middlewares/auth");
const router = express.Router();
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
router.post("/create", auth, createChat);
router.get("/my-chats", auth, getUserChats);
router.get("/:chatId/messages", auth, getChatMessages);

module.exports = router;
