const { Message, Chat, Car, User } = require("../models");

module.exports = (io) => {
  io.on("connection", (socket) => {
    // Extract userId from auth (passed by client)
    const userId = socket.handshake.auth.userId;
    if (!userId) {
      socket.emit("error", "Unauthorized: No user ID provided");
      socket.disconnect(true);
      return;
    }

    console.log("New client connected:", socket.id, "User:", userId);

    // Join a chat room
    socket.on("joinChat", async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId).populate("carId");
        if (!chat) {
          return socket.emit("error", "Chat not found");
        }

        // Verify user is a participant
        if (!chat.participants.includes(userId)) {
          return socket.emit("error", "Access denied: Not a chat participant");
        }

        // Verify car exists
        if (!chat.carId) {
          return socket.emit("error", "Invalid car associated with chat");
        }

        socket.join(chatId);
        console.log(`User ${userId} joined chat ${chatId}`);

        // Reset unread count for this user
        const unreadCounts = chat.unreadCounts || new Map();
        unreadCounts.set(userId, 0);
        await Chat.findByIdAndUpdate(chatId, { unreadCounts });

        // Send chat history
        const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
        socket.emit("chatHistory", messages);

        // Mark messages as seen
        await Message.updateMany(
          { chatId, seenBy: { $ne: userId } },
          { $addToSet: { seenBy: userId } }
        );

        // Notify participants of seen status
        const updatedMessages = await Message.find({ chatId }).sort({
          createdAt: 1,
        });
        io.to(chatId).emit("messagesSeen", updatedMessages);

        // Get updated chats for user (with updated unread counts)
        await sendUpdatedChatsToUser(userId);

        // Send total unread count to this user
        await sendTotalUnreadCount(userId);
      } catch (err) {
        console.error("Join Chat Error:", err);
        socket.emit("error", "Server error");
      }
    });

    // Helper function to send updated chats to a user
    async function sendUpdatedChatsToUser(userId) {
      try {
        // Fetch all chats for this user
        const userChats = await Chat.find({ participants: userId })
          .populate("carId", "title images")
          .sort({ "lastMessage.timestamp": -1 });

        // Get all participant IDs from all chats
        const participantIds = Array.from(
          new Set(userChats.flatMap((chat) => chat.participants))
        );

        // Find user data for all participants
        const users = await User.find({
          clerkUserId: { $in: participantIds },
        });

        // Create a map for easy lookup
        const userMap = {};
        users.forEach((user) => {
          userMap[user.clerkUserId] = user;
        });

        // Format chats with participant data and unread counts
        const formattedChats = userChats.map((chat) => {
          const chatObj = chat.toObject();

          // Add participant info
          chatObj.participantData = chat.participants.map((participantId) => {
            const participantUser = userMap[participantId];
            return {
              userId: participantId,
              name: participantUser
                ? `${participantUser.firstName} ${participantUser.lastName}`
                : "Unknown User",
              profilePicture: participantUser?.profilePicture || null,
              isCurrentUser: participantId === userId,
            };
          });

          // Add unread count for this user
          chatObj.unreadCount =
            chat.unreadCounts && chat.unreadCounts.get
              ? chat.unreadCounts.get(userId) || 0
              : 0;

          // Format last message data
          if (chatObj.lastMessage && chatObj.lastMessage.sender) {
            const senderUser = userMap[chatObj.lastMessage.sender];
            chatObj.lastMessage.senderName = senderUser
              ? `${senderUser.firstName} ${senderUser.lastName}`
              : "Unknown User";
          }

          return chatObj;
        });

        // Find the socket for this user
        const userSocket = [...io.sockets.sockets.values()].find(
          (s) => s.handshake.auth.userId === userId
        );

        if (userSocket) {
          userSocket.emit("updatedChats", formattedChats);
        }

        return formattedChats;
      } catch (err) {
        console.error("Error sending updated chats:", err);
        throw err;
      }
    }

    // Helper function to send total unread count to a user
    async function sendTotalUnreadCount(userId) {
      try {
        const chats = await Chat.find({ participants: userId });
        let totalUnread = 0;

        for (const chat of chats) {
          // Check if unreadCounts exists and has the userId
          if (
            chat.unreadCounts &&
            typeof chat.unreadCounts.get === "function"
          ) {
            totalUnread += chat.unreadCounts.get(userId) || 0;
          }
        }

        // Find the socket for this user
        const userSocket = [...io.sockets.sockets.values()].find(
          (s) => s.handshake.auth.userId === userId
        );

        if (userSocket) {
          console.log(
            `Sending total unread count to ${userId}: ${totalUnread}`
          );
          userSocket.emit("totalUnreadCount", totalUnread);
        }

        return totalUnread;
      } catch (err) {
        console.error("Error calculating total unread:", err);
        throw err;
      }
    }

    // Handle sending a message
    socket.on("sendMessage", async (messageData) => {
      const { chatId, text, tempId } = messageData;
      console.log("sendMessage", chatId, text, tempId);

      try {
        const chat = await Chat.findById(chatId).populate("carId");
        if (!chat) {
          return socket.emit("error", "Chat not found");
        }

        if (!chat.participants.includes(userId)) {
          return socket.emit("error", "Access denied: Not a chat participant");
        }

        // Check if user is blocked (similar to updateCar)
        const user = await User.findOne({ clerkUserId: userId });
        if (!user) {
          return socket.emit("error", "User not found");
        }
        if (user.blocked && user.role !== "admin") {
          return socket.emit("error", "Account is blocked");
        }

        const message = new Message({
          chatId,
          sender: userId,
          content: text, // Map text from client to content in database
          seenBy: [userId], // Sender sees their own message
        });

        await message.save();

        // Include the tempId in the response to allow frontend to match messages
        const messageObject = message.toObject();
        messageObject.tempId = tempId;
        messageObject.text = messageObject.content; // Add text field for frontend compatibility

        // Update the chat with last message info
        const lastMessage = {
          content: text,
          sender: userId,
          timestamp: new Date(),
        };

        // Update unread counts for all participants except sender
        const unreadCounts = chat.unreadCounts || new Map();

        for (const participant of chat.participants) {
          if (participant !== userId) {
            const currentCount = unreadCounts.get(participant) || 0;
            unreadCounts.set(participant, currentCount + 1);
          } else {
            unreadCounts.set(participant, 0); // Reset sender's unread count
          }
        }

        await Chat.findByIdAndUpdate(chatId, {
          lastMessage,
          unreadCounts,
        });

        // Send the message to all users in the chat
        io.to(chatId).emit("newMessage", messageObject);

        // Send updated chats to all participants
        for (const participant of chat.participants) {
          await sendUpdatedChatsToUser(participant);
          await sendTotalUnreadCount(participant);
        }
      } catch (err) {
        console.error("Send Message Error:", err);
        socket.emit("error", "Server error");
      }
    });

    // Handle typing indicator
    socket.on("typing", async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(userId)) {
          return socket.emit("error", "Access denied: Not a chat participant");
        }

        socket.to(chatId).emit("typing", { userId, chatId });
      } catch (err) {
        console.error("Typing Error:", err);
        socket.emit("error", "Server error");
      }
    });

    // Handle stop typing
    socket.on("stopTyping", async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(userId)) {
          return socket.emit("error", "Access denied: Not a chat participant");
        }

        socket.to(chatId).emit("stopTyping", { userId, chatId });
      } catch (err) {
        console.error("Stop Typing Error:", err);
        socket.emit("error", "Server error");
      }
    });

    // Handle marking messages as seen
    socket.on("markMessagesSeen", async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(userId)) {
          return socket.emit("error", "Access denied: Not a chat participant");
        }

        // Update messages
        await Message.updateMany(
          { chatId, seenBy: { $ne: userId } },
          { $addToSet: { seenBy: userId } }
        );

        const updatedMessages = await Message.find({ chatId }).sort({
          createdAt: 1,
        });
        io.to(chatId).emit("messagesSeen", updatedMessages);

        // Reset unread counter for this user
        const unreadCounts = chat.unreadCounts || new Map();
        unreadCounts.set(userId, 0);
        await Chat.findByIdAndUpdate(chatId, { unreadCounts });

        // Send updated chat lists to all participants
        for (const participant of chat.participants) {
          await sendUpdatedChatsToUser(participant);
        }

        // Send total unread count to this user
        await sendTotalUnreadCount(userId);
      } catch (err) {
        console.error("Mark Messages Seen Error:", err);
        socket.emit("error", "Server error");
      }
    });

    // Handle getting total unread count
    socket.on("getTotalUnreadCount", async () => {
      try {
        await sendTotalUnreadCount(userId);
      } catch (err) {
        console.error("Get Total Unread Error:", err);
        socket.emit("error", "Server error");
      }
    });

    // Handle car status update notification
    socket.on("carStatusUpdate", async ({ carId, status }) => {
      try {
        const chats = await Chat.find({ carId });
        for (const chat of chats) {
          io.to(chat._id.toString()).emit("carStatusUpdated", {
            carId,
            status,
          });
        }
      } catch (err) {
        console.error("Car Status Update Error:", err);
        socket.emit("error", "Server error");
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id, "User:", userId);
    });
  });
};
