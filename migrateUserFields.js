// backend/migrateUserFields.js
const mongoose = require("mongoose");
const User = require("./models/user");
require("dotenv").config();

async function migrateUserFields() {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Remove password-related fields and add sellerType
    const result = await User.updateMany(
      {},
      {
        $unset: {
          password: "",
          passwordResetToken: "",
          passwordResetExpires: "",
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
