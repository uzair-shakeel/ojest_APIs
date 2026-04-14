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
const { Chat, Message, User } = require("../models");
const mongoose = require("mongoose");

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

// Get recent messages from all user chats (for messages panel)
// Returns the last 3 unique people who sent you messages, sorted by message date
router.get("/recent-messages", auth, async (req, res) => {
  try {
    const userId = req.userId || req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Get ALL messages from your chats where sender is NOT you, sorted by newest first
    const allMessages = await Message.find({
      sender: { $ne: userId } // Only messages from others
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get unique chat IDs from these messages
    const chatIds = [...new Set(allMessages.map(m => m.chatId.toString()))];

    // Get chat info for these chats
    const chats = await Chat.find({
      _id: { $in: chatIds },
      participants: userId // Ensure user is participant
    })
      .populate("carId", "title images")
      .lean();

    const chatMap = new Map();
    chats.forEach(c => chatMap.set(c._id.toString(), c));

    // Group by sender - keep the latest message per sender
    const senderLatestMap = new Map();

    for (const msg of allMessages) {
      const chat = chatMap.get(msg.chatId.toString());
      if (!chat) continue; // Skip if chat not found or user not participant

      const senderId = msg.sender.toString();

      if (!senderLatestMap.has(senderId)) {
        // Get sender info
        const sender = await User.findById(senderId)
          .select("firstName lastName profilePicture image")
          .lean();

            // Count unread messages from this sender IN THIS SPECIFIC CHAT only
        // First, let's see what messages exist for this chat
        const chatMsgs = await Message.find({
          chatId: msg.chatId,
          sender: senderId
        }).select("seenBy").lean();

        // Count manually by comparing string IDs
        let unread = 0;
        const userIdStr = userId.toString();
        for (const m of chatMsgs) {
          const seenByIds = (m.seenBy || []).map(id => id.toString());
          if (!seenByIds.includes(userIdStr)) {
            unread++;
          }
        }

        senderLatestMap.set(senderId, {
          id: msg._id,
          chatId: msg.chatId,
          content: msg.content,
          attachments: msg.attachments || [],
          createdAt: msg.createdAt,
          sender: {
            id: senderId,
            name: sender
              ? `${sender.firstName} ${sender.lastName || ""}`.trim()
              : "Użytkownik",
            image: sender?.profilePicture || sender?.image || "",
          },
          car: chat.carId
            ? {
                id: chat.carId._id,
                title: chat.carId.title,
                image: chat.carId.images?.[0] || "",
              }
            : null,
          unreadCount: unread,
        });
      }
    }

    // Convert to array, already sorted by message date (descending from query)
    const result = Array.from(senderLatestMap.values()).slice(0, 3);

    console.log(`[recent-messages] Returning ${result.length} unique senders`);
    res.json(result);
  } catch (err) {
    console.error("Get Recent Messages Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Mark messages in a chat as seen by current user
router.post("/:chatId/mark-seen", auth, async (req, res) => {
  try {
    const userId = req.userId || req.auth?.userId;
    const { chatId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const chatObjectId = new mongoose.Types.ObjectId(chatId);

    // Update all messages in this chat from other participants to include user in seenBy
    const result = await Message.updateMany(
      {
        chatId: chatObjectId,
        sender: { $ne: userObjectId },
        seenBy: { $nin: [userObjectId] }
      },
      {
        $addToSet: { seenBy: userObjectId }
      }
    );

    console.log(`[mark-seen] Chat ${chatId}: marked ${result.modifiedCount} messages as seen by user ${userId}`);

    res.json({ success: true, markedAsSeen: result.modifiedCount });
  } catch (err) {
    console.error("Mark Seen Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Routes
router.post("/create", auth, createChat);
router.get("/my-chats", auth, getUserChats);
router.get("/:chatId/messages", auth, getChatMessages);

module.exports = router;
