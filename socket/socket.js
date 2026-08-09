const { User, Chat, Message } = require("../models");
const jwt = require("jsonwebtoken");

module.exports = (io) => {
  // Authenticate socket connections via JWT
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication required"));
      }
      if (!process.env.JWT_SECRET) {
        return next(new Error("Server misconfiguration"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("_id blocked isBlocked");
      if (!user || user.blocked || user.isBlocked) {
        return next(new Error("Unauthorized"));
      }

      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    // Join only the authenticated user's room
    socket.on("join", async () => {
      try {
        const userId = socket.userId;
        if (!userId) return;
        socket.join(userId);
        socket.join("general");
      } catch (error) {
        console.error("Error in join:", error);
      }
    });

    // Auto-join personal room on connect
    if (socket.userId) {
      socket.join(socket.userId);
      socket.join("general");
    }

    socket.on("sendMessage", async (data) => {
      try {
        const { chatId, content, attachments, tempId } = data;
        const senderId = socket.userId;

        if (!chatId || !senderId) {
          socket.emit("error", { message: "Missing required fields", tempId });
          return;
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit("error", { message: "Chat not found", tempId });
          return;
        }

        const isParticipant = (chat.participants || []).some(
          (p) => String(p) === String(senderId)
        );
        if (!isParticipant) {
          socket.emit("error", { message: "Access denied", tempId });
          return;
        }

        const message = new Message({
          chatId,
          sender: senderId,
          content: content || "",
          attachments: Array.isArray(attachments) ? attachments : [],
        });

        await message.save();

        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: {
            content: content || "",
            sender: senderId,
            timestamp: new Date(),
          },
        });

        const sender = await User.findById(senderId).select(
          "firstName profilePicture"
        );

        chat.participants.forEach((participantId) => {
          const roomId = String(participantId);
          io.to(roomId).emit("newMessage", {
            chatId,
            tempId,
            message: {
              id: message._id,
              content: content || "",
              sender: {
                _id: senderId,
                firstName: sender?.firstName || "User",
                profilePicture: sender?.profilePicture || "",
              },
              attachments: attachments || [],
              timestamp: message.createdAt,
            },
          });
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", {
          message: "Failed to send message",
          tempId: data?.tempId,
        });
      }
    });

    socket.on("typing", async (data) => {
      try {
        const { chatId, isTyping } = data;
        const userId = socket.userId;
        if (!chatId || !userId) return;

        const chat = await Chat.findById(chatId).select("participants");
        if (!chat) return;
        const isParticipant = (chat.participants || []).some(
          (p) => String(p) === String(userId)
        );
        if (!isParticipant) return;

        socket.to(chatId).emit("userTyping", {
          chatId,
          userId,
          isTyping,
        });
      } catch (error) {
        console.error("Error in typing:", error);
      }
    });

    socket.on("markAsRead", async (data) => {
      try {
        const { chatId } = data;
        const userId = socket.userId;
        if (!chatId || !userId) return;

        const chat = await Chat.findById(chatId).select("participants");
        if (!chat) return;
        const isParticipant = (chat.participants || []).some(
          (p) => String(p) === String(userId)
        );
        if (!isParticipant) return;

        await Chat.findByIdAndUpdate(chatId, {
          $set: { [`unreadCounts.${userId}`]: 0 },
        });

        socket.to(chatId).emit("messageRead", {
          chatId,
          userId,
        });
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    });

    socket.on("userStatus", (data) => {
      const status = data?.status;
      io.emit("userStatusChanged", {
        userId: socket.userId,
        status,
      });
    });

    socket.on("disconnect", () => {});
  });
};
