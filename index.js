// Load Environment & Dependencies
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const carController = require("./controllers/car"); // Adjust path
const { auth } = require("./middlewares/auth");
const buyerRequestRoutes = require("./routes/buyerRequest");
const sellerOfferRoutes = require("./routes/sellerOffer");
const userRoutes = require("./routes/user");
const carRoutes = require("./routes/car");
const chatRoutes = require("./routes/chat");
const webhookRoutes = require("./routes/webhook");
const authRoutes = require("./routes/auth");
const imageDetectionRoutes = require("./routes/imageDetection");

// Connect to Database
const { connectDB } = require("./config/connect");

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Configure CORS to allow specific origins
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
  "http://209.38.211.146",
  "https://ojest.pl",
  "https://www.ojest.pl",
  "http://64.227.68.1",
  "https://64.227.68.1",
  "http://64.227.68.1:3000",
  "https://64.227.68.1:3000",
  "https://ojest-client.vercel.app",
  "https://b7e6e2a7a0f3c7f3b3b0c7b8e0f6b7a6c2e.vercel.app",
  "https://ojest-sell-two.vercel.app",
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  path: "/socket.io/",
});


app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) {
        console.log("Request with no origin allowed");
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) === -1 && !origin.endsWith(".ojest.pl")) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
        console.log(msg);
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Explicitly enable preflight across all routes
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
  next();
});

// Debug route to check if API is working
app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working correctly",
    timestamp: new Date().toISOString(),
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Set Up Routes
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/buyer-requests", buyerRequestRoutes);
app.use("/api/seller-offers", sellerOfferRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/image-detection", imageDetectionRoutes);
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

    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API Documentation available at http://localhost:${PORT}/api`);
    });


  } catch (error) {
    console.error("Failed to start server:", error);
    // For development, start server even if MongoDB fails
    if (process.env.NODE_ENV === "development") {
      console.log("Starting server without MongoDB for development...");
      server.listen(PORT, "127.0.0.1", () => {
        console.log(`Server is running on port ${PORT} (without MongoDB)`);
        console.log(`API Documentation available at http://localhost:${PORT}/api`);
      });


    } else {
      process.exit(1);
    }
  }
};

startServer();
