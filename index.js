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
  "http://localhost:3001",
  "https://ojest-client.vercel.app",
  "https://ojest-sell-two.vercel.app",
];

// Log CORS configuration
console.log("CORS allowed origins:", allowedOrigins);

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
      console.log("CORS allowed for origin:", origin);
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
  console.log(`${req.method} ${req.url}`);
  next();
});

// Debug route to check if API is working
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working correctly" });
});

// Debug route to check authentication
app.get("/api/auth-test", clerkAuth, (req, res) => {
  console.log("Auth test route called");
  console.log("Auth object:", req.auth);

  res.json({
    message: "Authentication test",
    auth: req.auth
      ? {
          userId: req.auth.userId,
          sessionId: req.auth.sessionId,
          tokenAvailable: !!req.auth.getToken,
        }
      : null,
  });
});

// Set Up Routes
console.log("Setting up routes...");
app.use("/api/users", require("./routes/user"));
app.use("/api/cars", require("./routes/car"));
app.use("/api/chat", require("./routes/chat"));
const buyerRequestRoutes = require("./routes/buyerRequest");
app.use("/api/buyer-requests", buyerRequestRoutes);

try {
  const sellerOfferRoutes = require("./routes/sellerOffer");
  console.log("Seller offer routes loaded successfully");
  app.use("/api/seller-offers", sellerOfferRoutes);
} catch (error) {
  console.error("Error loading seller offer routes:", error);
}

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

      // Log all available routes for debugging
      console.log("\nAvailable Routes:");
      app._router.stack.forEach((r) => {
        if (r.route && r.route.path) {
          console.log(
            `${Object.keys(r.route.methods).join(", ").toUpperCase()} ${
              r.route.path
            }`
          );
        } else if (r.name === "router" && r.handle.stack) {
          const basePath = r.regexp
            .toString()
            .replace("\\^", "")
            .replace("\\/?(?=\\/|$)", "")
            .replace(/\\\//g, "/")
            .replace("$", "");
          r.handle.stack.forEach((sr) => {
            if (sr.route) {
              const fullPath = basePath + sr.route.path;
              console.log(
                `${Object.keys(sr.route.methods)
                  .join(", ")
                  .toUpperCase()} ${fullPath}`
              );
            }
          });
        }
      });
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
