const express = require("express");
const { auth } = require("../middlewares/auth");
const router = express.Router();
const {
  createChat,
  getUserChats,
  getChatMessages,
} = require("../controllers/chat");
const {
  upload,
  uploadToCloudinary,
} = require("../middlewares/uploadMiddleware");

// Debug route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes are working" });
});

// Upload attachments to Cloudinary
router.post(
  "/upload-attachments",
  auth,
  upload.array("attachments", 10),
  uploadToCloudinary,
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const attachments = req.files.map((file) => ({
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      url: file.cloudinaryUrl || file.path,
    }));

    res.json({ attachments });
  }
);

// Routes
router.post("/create", auth, createChat);
router.get("/my-chats", auth, getUserChats);
router.get("/:chatId/messages", auth, getChatMessages);

module.exports = router;
