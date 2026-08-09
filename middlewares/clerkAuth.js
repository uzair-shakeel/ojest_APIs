/**
 * DEPRECATED — insecure stub that decoded JWTs without verification.
 * Do not use. Prefer ../middlewares/auth.js (`auth` / `admin`).
 */
module.exports = {
  clerkAuth: (req, res) => {
    return res.status(501).json({
      message: "clerkAuth middleware is disabled. Use standard JWT auth.",
    });
  },
  getAuth: () => ({ userId: null, user: null }),
};
