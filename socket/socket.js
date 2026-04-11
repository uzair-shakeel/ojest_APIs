const { User, Chat, Message } = require("../models");

module.exports = (io) => {
  io.on("connection", (socket) => {
    // console.log("User connected:", socket.id);

    // Join user to their personal room
    socket.on("join", async (userId) => {
      try {
        if (!userId) {
          console.log("No userId provided for join");
          return;
        }

        // Join user to their personal room
        socket.join(userId);
        // console.log(`User ${userId} joined their room`);

        // Also join to a general room for broadcast messages
        socket.join("general");
      } catch (error) {
        console.error("Error in join:", error);
      }
    });

    // Handle new message
    socket.on("sendMessage", async (data) => {
      try {
        const { chatId, content, senderId, attachments, tempId } = data;
        console.log("📩 Incoming sendMessage:", { chatId, senderId, content, attachmentsCount: attachments?.length });

        if (!chatId || !senderId) {
          console.log("Missing required fields for message");
          return;
        }

        // Debug schema
        if (Message && Message.schema && Message.schema.paths.attachments) {
          console.log("🔍 [DEBUG] Backend Message.attachments schema type:", Message.schema.paths.attachments.constructor.name);
        }

        console.log("🔍 [DEBUG] attachments[0]:", attachments[0], typeof attachments[0]);

        // Create new message
        const messageData = {
          chatId,
          sender: senderId,
          content: content || "",
          attachments: Array.isArray(attachments) ? attachments : [],
        };
        
        const message = new Message(messageData);

        await message.save();

        // Update chat's last message
        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: {
            content: content || "",
            sender: senderId,
            timestamp: new Date(),
          },
        });

        // Get chat participants
        const chat = await Chat.findById(chatId);
        if (!chat) {
          console.log("Chat not found");
          return;
        }

        // Get sender info
        const sender = await User.findById(senderId).select("firstName profilePicture");

        // Emit message to all participants (rooms are joined by string userId)
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
                profilePicture: sender?.profilePicture || ""
              },
              attachments: attachments || [],
              timestamp: message.createdAt,
            },
          });
        });

        console.log(`Message sent to chat ${chatId}`);
      } catch (error) {
        console.error("Error sending message:", error);
        console.log("Current data for error report:", { chatId: data?.chatId, tempId: data?.tempId });
        socket.emit("error", {
          message: "Failed to send message",
          details: error.message,
          tempId: data?.tempId
        });
      }
    });

    // Handle typing indicator
    socket.on("typing", (data) => {
      const { chatId, userId, isTyping } = data;

      // Emit typing indicator to other users in the chat
      socket.to(chatId).emit("userTyping", {
        chatId,
        userId,
        isTyping,
      });
    });

    // Handle message read
    socket.on("markAsRead", async (data) => {
      try {
        const { chatId, userId } = data;

        // Update unread count for the user
        await Chat.findByIdAndUpdate(chatId, {
          $set: { [`unreadCounts.${userId}`]: 0 },
        });

        // Notify other participants
        socket.to(chatId).emit("messageRead", {
          chatId,
          userId,
        });
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    });

    // Handle user status
    socket.on("userStatus", (data) => {
      const { userId, status } = data;

      // Broadcast user status to all connected users
      io.emit("userStatusChanged", {
        userId,
        status,
      });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      // console.log("User disconnected:", socket.id);
    });
  });
};
