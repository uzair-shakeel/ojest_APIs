const mongoose = require("mongoose");
const { User } = require("./models");

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ojest", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createAdminUser() {
  try {
    console.log("🔐 Creating admin user...\n");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("✅ Admin user already exists:");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(
        `   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`
      );
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Approval Status: ${existingAdmin.approvalStatus}`);
      return;
    }

    // Create admin user
    const adminUser = new User({
      email: "admin@ojest.com",
      password: "admin123456",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      approvalStatus: "approved", // Admin is auto-approved
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    await adminUser.save();
    console.log("✅ Admin user created successfully!");
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: admin123456`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Approval Status: ${adminUser.approvalStatus}`);
    console.log("\n🔑 Use these credentials to login to the admin panel");
    console.log("⚠️  Remember to change the password after first login!");
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    mongoose.connection.close();
  }
}

createAdminUser();

