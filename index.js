// Load Environment & Dependencies
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const https = require("https"); // Changed from http
const fs = require("fs"); // For SSL files
const { Server } = require("socket.io");
const { clerkMiddleware } = require("@clerk/express");
const carController = require("./controllers/car"); // Adjust path

// Connect to Database
require("./config/connect");

// Initialize Express App
const app = express();

// Load SSL certificate files
const sslOptions = {
  cert: fs.readFileSync("/etc/ssl/certs/ojest.pl.crt"),
  key: fs.readFileSync("/etc/ssl/private/ojest.pl.key"),
  ca: fs.readFileSync("/etc/ssl/certs/ojest.pl.ca-bundle.pem"),
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

// Configure Socket.IO with CORS for all frontend domains
const allowedOrigins = [
  "http://localhost:3000",
  "https://ojest-sell-opal.vercel.app",
  "https://ojest.pl", // Replace with your third frontend domain
];
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Configure Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
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

// Serve static files from the "uploads" directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Set Up Routes
app.use("/api/users", require("./routes/user"));
app.use("/api/cars", require("./routes/car"));
app.use("/api/chat", require("./routes/chat"));

// Pass io to car controller
carController.setIo(io);

// Socket.IO Logic
require("./socket/socket")(io);

// Redirect HTTP to HTTPS
const http = require("http");
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
  })
  .listen(80);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start the Server
const PORT = 443; // Standard HTTPS port
server.listen(PORT, () => {
  console.log(`Server is running on https://ojest.pl:${PORT}`);
  console.log(`API Documentation available at https://ojest.pl:${PORT}/api`);
});
