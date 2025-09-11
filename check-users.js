const mongoose = require("mongoose");
require("dotenv").config();

async function checkUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ojest"
    );
    console.log("Connected to MongoDB");

    const { User } = require("./models");

    // Find all users
    const allUsers = await User.find({});

    console.log(`Found ${allUsers.length} users in database:`);

    allUsers.forEach((user) => {
      console.log(`- User ID: ${user._id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Phone: ${user.phoneNumber || "N/A"}`);
      console.log(`  Has Password: ${!!user.password}`);
      console.log(`  Google ID: ${user.googleId || "N/A"}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log("---");
    });

    // Check for specific email
    const searchEmail = "uzairshakeel@gmail.com";
    const userWithEmail = await User.findOne({
      email: searchEmail.toLowerCase(),
    });

    if (userWithEmail) {
      console.log(`\nFound user with email ${searchEmail}:`);
      console.log(`- User ID: ${userWithEmail._id}`);
      console.log(`  Has Password: ${!!userWithEmail.password}`);
    } else {
      console.log(`\nNo user found with email ${searchEmail}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkUsers();
