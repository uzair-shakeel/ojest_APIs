const axios = require("axios");

const API_BASE = "http://localhost:5000/api";

async function testAuth() {
  try {
    console.log("Testing auth endpoints...");

    // Test health endpoint
    const health = await axios.get(`${API_BASE}/health`);
    console.log("✅ Health check:", health.data);

    // Test signup
    const signupData = {
      email: "test@example.com",
      password: "123456",
      firstName: "Test",
      lastName: "User",
    };

    console.log("Testing signup...");
    const signup = await axios.post(`${API_BASE}/auth/signup`, signupData);
    console.log("✅ Signup response:", signup.data);

    // Test signin
    const signinData = {
      email: "test@example.com",
      password: "123456",
    };

    console.log("Testing signin...");
    const signin = await axios.post(`${API_BASE}/auth/signin`, signinData);
    console.log("✅ Signin response:", signin.data);
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

testAuth();
