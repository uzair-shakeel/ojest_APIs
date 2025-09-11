const mongoose = require("mongoose");
require("dotenv").config();

async function fixClerkIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ojest"
    );
    console.log("Connected to MongoDB");

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    // List all indexes
    const indexes = await usersCollection.indexes();
    console.log("Current indexes:", indexes);

    // Drop the clerkUserId index if it exists (legacy from Clerk)
    try {
      await usersCollection.dropIndex("clerkUserId_1");
      console.log("Successfully dropped clerkUserId_1 index");
    } catch (error) {
      if (error.code === 26) {
        console.log("clerkUserId_1 index doesn't exist, skipping...");
      } else {
        console.error("Error dropping index:", error);
      }
    }

    console.log(
      "Index cleanup completed - now using _id for user identification"
    );
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixClerkIndex();
