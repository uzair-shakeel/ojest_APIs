// backend/routes/webhook.js
const express = require("express");
const router = express.Router();
const { Webhook } = require("svix");
const { User, Car } = require("../models");

// Webhook endpoint to sync Clerk users with MongoDB
router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    const headers = req.headers;
    const payload = req.body;
    const svix_id = headers["svix-id"];
    const svix_timestamp = headers["svix-timestamp"];
    const svix_signature = headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: "Missing svix headers" });
    }

    const wh = new Webhook(WEBHOOK_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Webhook verification failed:", err.message);
      return res.status(400).json({ error: "Webhook verification failed" });
    }

    const {
      id,
      email_addresses,
      first_name,
      last_name,
      image_url,
      public_metadata,
    } = evt.data;
    const eventType = evt.type;

    try {
      if (eventType === "user.created" || eventType === "user.updated") {
        const email = email_addresses[0]?.email_address;
        if (!email) {
          return res.status(400).json({ error: "No email provided" });
        }

        const sellerType = public_metadata?.sellerType || "private";
        const role = public_metadata?.role || "user";
        const phoneNumbers = public_metadata?.phoneNumbers || [];
        const socialMedia = public_metadata?.socialMedia || {
          instagram: "",
          facebook: "",
          twitter: "",
          website: "",
          linkedin: "",
        };
        const location = public_metadata?.location || [0, 0];
        const description = public_metadata?.description || "";
        const companyName = public_metadata?.companyName || "";

        await User.findOneAndUpdate(
          { clerkUserId: id },
          {
            clerkUserId: id,
            email,
            firstName: first_name || "",
            lastName: last_name || "",
            image: image_url || "",
            sellerType,
            role,
            phoneNumbers,
            socialMedia,
            location,
            description,
            companyName,
            updatedAt: new Date(),
          },
          { upsert: true, new: true }
        );
        console.log(`User ${eventType}:`, id);
      } else if (eventType === "user.deleted") {
        await User.deleteOne({ clerkUserId: id });
        await Car.deleteMany({ createdBy: id });
        console.log("User and their cars deleted:", id);
      }

      return res
        .status(200)
        .json({ success: true, message: "Webhook processed" });
    } catch (err) {
      console.error("Error processing webhook:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
