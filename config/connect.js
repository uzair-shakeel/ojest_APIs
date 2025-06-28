const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "mern-practice",
  api_key: process.env.CLOUDINARY_API_KEY || "748289359289231",
  api_secret:
    process.env.CLOUDINARY_API_SECRET || "Qz_0OA9kSwfu0sV5DVCYet2TfHc",
});

module.exports = { mongoose, cloudinary };
