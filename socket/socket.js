const { User, Chat, Message } = require("../models");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join user to their personal room
    socket.on("join", async (userId) => {
      try {
        if (!userId) {
          console.log("No userId provided for join");
          return;
        }

        // Join user to their personal room
        socket.join(userId);
        console.log(`User ${userId} joined their room`);

        // Also join to a general room for broadcast messages
        socket.join("general");
      } catch (error) {
        console.error("Error in join:", error);
      }
    });

    // Handle new message
    socket.on("sendMessage", async (data) => {
      try {
        const { chatId, content, senderId } = data;

        if (!chatId || !content || !senderId) {
          console.log("Missing required fields for message");
          return;
        }

        // Create new message
        const message = new Message({
          chatId,
          sender: senderId,
          content,
        });

        await message.save();

        // Update chat's last message
        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: {
            content,
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

        // Emit message to all participants (rooms are joined by string userId)
        chat.participants.forEach((participantId) => {
          const roomId = String(participantId);
          io.to(roomId).emit("newMessage", {
            chatId,
            message: {
              id: message._id,
              content,
              sender: senderId,
              timestamp: message.createdAt,
            },
          });
        });

        console.log(`Message sent to chat ${chatId}`);
      } catch (error) {
        console.error("Error sending message:", error);
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
      console.log("User disconnected:", socket.id);
    });
  });
};
