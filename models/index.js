const mongoose = require("mongoose");

// User Schema Definition
const userSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    socialMedia: {
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      website: { type: String, default: "" },
      linkedin: { type: String, default: "" },
    },
    phoneNumbers: {
      type: [String],
      default: [],
    },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [21.01178, 52.22977] }, // [lng, lat]
    },
    image: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    sellerType: {
      type: String,
      enum: ["private", "company"],
      default: "private",
      required: true,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Message Schema
const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  seenBy: [
    {
      type: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Chat Schema
const chatSchema = new mongoose.Schema({
  participants: [
    {
      type: String,
      required: true,
    },
  ],
  carId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Car",
    required: true,
  },
  lastMessage: {
    content: String,
    sender: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Car Schema
const carSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [String],
      validate: [
        {
          validator: (value) => value.length >= 1,
          message: "At least 1 image is required.",
        },
        {
          validator: (value) => value.length <= 10,
          message: "A car can have a maximum of 10 images.",
        },
      ],
      required: true,
    },
    make: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    trim: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    condition: {
      type: String,
      enum: ["New", "Used"],
      trim: true,
      required: true,
    },
    mileage: {
      type: String,
      trim: true,
    },
    drivetrain: {
      type: String,
      enum: ["FWD", "RWD", "AWD", "4WD", "2WD"],
    },
    transmission: {
      type: String,
      enum: ["Manual", "Automatic", "Semi-Automatic"],
    },
    fuel: {
      type: String,
      enum: ["Petrol", "Diesel", "Electric", "Hybrid"],
    },
    engine: {
      type: String,
      trim: true,
    },
    horsepower: {
      type: String,
      trim: true,
    },
    accidentHistory: {
      type: String,
      enum: ["Yes", "No"],
      trim: true,
    },
    serviceHistory: {
      type: String,
      enum: ["Yes", "No"],
      trim: true,
    },
    vin: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    carCondition: {
      interior: {
        type: String,
        enum: ["New", "Very Good", "Good", "Normal", "Bad"],
        trim: true,
      },
      mechanical: {
        type: String,
        enum: ["New", "Very Good", "Good", "Normal", "Bad"],
        trim: true,
      },
      paintandBody: {
        type: String,
        enum: ["New", "Very Good", "Good", "Normal", "Bad"],
        trim: true,
      },
      frameandUnderbody: {
        type: String,
        enum: ["New", "Very Good", "Good", "Normal", "Bad"],
        trim: true,
      },
      overall: {
        type: String,
        enum: ["New", "Very Good", "Good", "Normal", "Bad"],
        trim: true,
      },
    },
    financialInfo: {
      sellOptions: {
        type: [String],
        required: true,
        enum: ["Long term rental", "Financing", "Lease", "Cash"],
      },
      invoiceOptions: {
        type: [String],
        required: true,
        enum: ["Invoice", "Selling Agreement", "Invoice VAT"],
      },
      sellerType: {
        type: String,
        required: true,
        enum: ["private", "company"],
      },
      priceNetto: {
        type: Number,
        required: true,
        trim: true,
      },
      priceWithVat: {
        type: Number,
        trim: true,
      },
    },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Buyer Request Schema
const buyerRequestSchema = new mongoose.Schema(
  {
    buyerId: {
      type: String,
      required: true,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    make: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    yearFrom: {
      type: Number,
      trim: true,
    },
    yearTo: {
      type: Number,
      trim: true,
    },
    budgetMin: {
      type: Number,
      trim: true,
    },
    budgetMax: {
      type: Number,
      required: true,
      trim: true,
    },
    preferredCondition: {
      type: String,
      enum: ["New", "Used", "Any"],
      default: "Any",
    },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [21.01178, 52.22977] },
    },
    preferredFeatures: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["Active", "Fulfilled", "Expired", "Cancelled"],
      default: "Active",
    },
    expiryDate: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days from creation
    },
  },
  {
    timestamps: true,
  }
);

// Seller Offer Schema
const sellerOfferSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerRequest",
      required: true,
    },
    sellerId: {
      type: String,
      required: true,
      ref: "User",
    },
    carId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Expired"],
      default: "Pending",
    },
    expiryDate: {
      type: Date,
      default: () => new Date(+new Date() + 7 * 24 * 60 * 60 * 1000), // 7 days from creation
    },
    isCustomOffer: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create models only if they haven't been compiled yet
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);
const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);
const Car = mongoose.models.Car || mongoose.model("Car", carSchema);
const BuyerRequest =
  mongoose.models.BuyerRequest ||
  mongoose.model("BuyerRequest", buyerRequestSchema);
const SellerOffer =
  mongoose.models.SellerOffer ||
  mongoose.model("SellerOffer", sellerOfferSchema);

module.exports = {
  User,
  Message,
  Chat,
  Car,
  BuyerRequest,
  SellerOffer,
};
