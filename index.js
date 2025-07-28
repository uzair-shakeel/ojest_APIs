// Load Environment & Dependencies
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { clerkMiddleware } = require("@clerk/express");
const carController = require("./controllers/car"); // Adjust path
const { clerkAuth } = require("./middlewares/clerkAuth");
const buyerRequestRoutes = require("./routes/buyerRequest");
const sellerOfferRoutes = require("./routes/sellerOffer");
const userRoutes = require("./routes/user");
const carRoutes = require("./routes/car");
const chatRoutes = require("./routes/chat");
const webhookRoutes = require("./routes/webhook");

// Connect to Database
const { connectDB } = require("./config/connect");

// Initialize Express App
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Configure CORS to allow specific origins
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
  "https://ojest-client.vercel.app",
  "https://ojest-sell-two.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) {
        console.log("Request with no origin allowed");
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
        console.log(msg);
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());
app.use(
  clerkMiddleware({
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })
);
app.use(express.urlencoded({ extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
  next();
});

// Debug route to check if API is working
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working correctly" });
});

// Set Up Routes

app.use("/api/users", userRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/buyer-requests", buyerRequestRoutes);
app.use("/api/seller-offers", sellerOfferRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api", webhookRoutes);

// Pass io to car controller
carController.setIo(io);
// Socket.IO Logic
require("./socket/socket")(io);

// Handle unknown routes
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start the Server
const PORT = process.env.PORT || 5000;

// Start server only after MongoDB connection is established
const startServer = async () => {
  try {
    // Wait for MongoDB connection
    await connectDB;

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(
        `API Documentation available at http://localhost:${PORT}/api`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
