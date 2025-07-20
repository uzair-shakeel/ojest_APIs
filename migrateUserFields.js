// backend/migrateUserFields.js
const mongoose = require("mongoose");
const { User } = require("./models");
require("dotenv").config();

async function migrateUserFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
    console.log("MongoDB URI:", process.env.MONGODB_URI);

    // Drop the username index that's causing duplicate key errors
    try {
      console.log("Attempting to drop username index...");
      await mongoose.connection.db.collection("users").dropIndex("username_1");
      console.log("Successfully dropped username index");
    } catch (indexError) {
      console.log(
        "No username index found or error dropping index:",
        indexError.message
      );
    }

    // Remove password-related fields and add sellerType
    const result = await User.updateMany(
      {},
      {
        $unset: {
          password: "",
          passwordResetToken: "",
          passwordResetExpires: "",
          username: "", // Also unset the username field
        },
        $set: {
          sellerType: "private", // Set default sellerType
        },
      }
    );

    console.log(
      `Updated ${result.modifiedCount} users: removed password fields and added sellerType`
    );
    mongoose.disconnect();
  } catch (err) {
    console.error("Migration error:", err);
    mongoose.disconnect();
  }
}

migrateUserFields();
