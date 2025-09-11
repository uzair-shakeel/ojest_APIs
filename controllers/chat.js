const { Chat, Message, User, Car } = require("../models");

// Create a new chat
exports.createChat = async (req, res) => {
  const { carId, ownerId } = req.body;
  const buyerId = req.userId; // From custom auth middleware

  try {
    console.log("[DEBUG] Incoming createChat body:", req.body);
    console.log("[DEBUG] buyerId:", buyerId);

    if (!buyerId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findById(buyerId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.blocked && user.role !== "admin") {
      return res.status(403).json({ message: "Account is blocked" });
    }

    const car = await Car.findById(carId);
    if (!car) {
      console.error(`[DEBUG] Car not found for carId: ${carId}`);
      return res.status(404).json({ message: "Car not found" });
    }
    const carCreatedByStr = String(car.createdBy);
    const ownerIdStr = String(ownerId);
    console.log(
      `[DEBUG] carId: ${carId}, ownerId: ${ownerIdStr}, car.createdBy: ${carCreatedByStr}`
    );
    if (carCreatedByStr !== ownerIdStr) {
      console.error(
        `[DEBUG] Owner mismatch: car.createdBy (${carCreatedByStr}) !== ownerId (${ownerIdStr})`
      );
      return res.status(400).json({
        message: `Invalid owner for this car. car.createdBy=${carCreatedByStr}, ownerId=${ownerIdStr}`,
      });
    }
    console.log("[DEBUG] Full car object:", car);
    console.log("[DEBUG] car.createdBy:", car.createdBy, "ownerId:", ownerId);

    let chat = await Chat.findOne({
      carId,
      participants: { $all: [buyerId, ownerId] },
    });

    if (!chat) {
      // Initialize unreadCounts for both participants
      const unreadCounts = new Map();
      unreadCounts.set(buyerId, 0);
      unreadCounts.set(ownerId, 0);

      chat = new Chat({
        participants: [buyerId, ownerId],
        carId,
        unreadCounts,
      });
      await chat.save();
    }

    res.status(201).json(chat);
  } catch (err) {
    console.error("Create Chat Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all chats for a user
exports.getUserChats = async (req, res) => {
  const userId = req.auth?.userId;

  try {
    console.log("[DEBUG] getUserChats - userId:", userId);

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find all chats where the user is a participant
    const chats = await Chat.find({ participants: userId })
      .populate("carId", "title images")
      .sort({ "lastMessage.timestamp": -1 });

    // Get all participant IDs from all chats
    const participantIds = Array.from(
      new Set(chats.flatMap((chat) => chat.participants))
    );

    // Find all users corresponding to the participants
    const users = await User.find({
      _id: { $in: participantIds },
    });

    // Create a map of user data
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = user;
    });

    // Add user data to each chat
    const chatsWithUsers = chats.map((chat) => {
      const chatObj = chat.toObject();
      chatObj.participants = chat.participants.map((participantId) => {
        const user = userMap[participantId];
        return {
          id: participantId,
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          email: user?.email || "",
          image: user?.image || "",
        };
      });
      return chatObj;
    });

    res.json(chatsWithUsers);
  } catch (err) {
    console.error("Get User Chats Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get messages for a chat
exports.getChatMessages = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.auth?.userId;

  try {
    console.log("[DEBUG] getChatMessages - userId:", userId);

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const chat = await Chat.findById(chatId).populate("carId");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    if (!chat.participants.includes(userId)) {
      return res
        .status(403)
        .json({ message: "Access denied: Not a chat participant" });
    }

    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });

    // Get user data for all senders
    const senderIds = Array.from(
      new Set(messages.map((message) => message.sender))
    );

    const users = await User.find({
      _id: { $in: senderIds },
    });

    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = user;
    });

    // Add sender information to each message
    const enhancedMessages = messages.map((message) => {
      const messageObj = message.toObject();
      const senderUser = userMap[message.sender];

      messageObj.senderName = senderUser
        ? `${senderUser.firstName} ${senderUser.lastName}`
        : "Unknown User";
      messageObj.senderProfilePic = senderUser?.profilePicture || null;

      return messageObj;
    });

    // Reset unread count for this user
    if (chat.unreadCounts) {
      const unreadCounts = chat.unreadCounts;
      unreadCounts.set(userId, 0);
      await Chat.findByIdAndUpdate(chatId, { unreadCounts });
    }

    res.json(enhancedMessages);
  } catch (err) {
    console.error("Get Chat Messages Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
