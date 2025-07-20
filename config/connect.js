const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

// MongoDB connection options
const mongoOptions = {
  serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10, // Adjust based on your application needs
};

// Create a connection promise
const connectDB = mongoose
  .connect(process.env.MONGODB_URI, mongoOptions)
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1); // Exit process with failure if connection fails
  });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "mern-practice",
  api_key: process.env.CLOUDINARY_API_KEY || "748289359289231",
  api_secret:
    process.env.CLOUDINARY_API_SECRET || "Qz_0OA9kSwfu0sV5DVCYet2TfHc",
});

module.exports = { mongoose, cloudinary, connectDB };
