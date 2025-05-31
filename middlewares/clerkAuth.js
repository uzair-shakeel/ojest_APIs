// backend/middlewares/clerkAuth.js
const { ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

const clerkAuth = ClerkExpressWithAuth();

const getAuth = (req) => {
  return req.auth || {};
};

module.exports = { clerkAuth, getAuth };