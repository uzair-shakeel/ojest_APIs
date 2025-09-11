const mongoose = require("mongoose");
require("dotenv").config();

async function fixNullPasswords() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ojest"
    );
    console.log("Connected to MongoDB");

    const { User } = require("./models");

    // Find users with null or undefined passwords
    const usersWithNullPasswords = await User.find({
      $or: [{ password: null }, { password: undefined }, { password: "" }],
    });

    console.log(
      `Found ${usersWithNullPasswords.length} users with null/empty passwords:`
    );

    usersWithNullPasswords.forEach((user) => {
      console.log(`- User ID: ${user._id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Phone: ${user.phoneNumber}`);
      console.log(`  Google ID: ${user.googleId || "N/A"}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log("---");
    });

    if (usersWithNullPasswords.length > 0) {
      console.log(
        "\nThese users likely signed up with Google OAuth and don't have passwords."
      );
      console.log(
        "They should sign in using Google OAuth instead of email/password."
      );
    } else {
      console.log("No users with null passwords found.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixNullPasswords();
