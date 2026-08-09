const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User } = require("./models");

// Connect to MongoDB using the same connection as your main app
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ojest", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createRealAdminUser() {
  try {
    console.log("🔐 Creating real admin user...\n");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("✅ Admin user already exists:");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Approval Status: ${existingAdmin.approvalStatus}`);
      console.log(`   Password Hash: ${existingAdmin.password ? "Set" : "Not set"}`);
      return;
    }

    // Hash password — MUST come from env (never hardcode)
    const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!adminPassword || adminPassword.length < 12) {
      console.error(
        "❌ Set ADMIN_BOOTSTRAP_PASSWORD (min 12 chars) in the environment before running this script."
      );
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    const adminUser = new User({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@ojest.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      approvalStatus: "approved", // Admin is auto-approved
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    await adminUser.save();
    console.log("✅ Real admin user created successfully!");
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: (from ADMIN_BOOTSTRAP_PASSWORD)`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Approval Status: ${adminUser.approvalStatus}`);
    console.log(`   Password Hash: ${adminUser.password ? "Set" : "Not set"}`);
    console.log("\n🔑 Use these credentials to login to the admin panel");
    console.log("⚠️  Remember to change the password after first login!");

  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    mongoose.connection.close();
  }
}

createRealAdminUser();

