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

    // Create admin user — password MUST come from env (never hardcode)
    const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!adminPassword || adminPassword.length < 12) {
      console.error(
        "❌ Set ADMIN_BOOTSTRAP_PASSWORD (min 12 chars) in the environment before running this script."
      );
      process.exit(1);
    }

    const adminUser = new User({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@ojest.com",
      password: adminPassword,
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

