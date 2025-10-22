const { parsePhoneNumber, isValidPhoneNumber } = require("libphonenumber-js");
const twilio = require("twilio");
const nodemailer = require("nodemailer");

// Initialize Twilio client (only if credentials are available)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Initialize Nodemailer transporter (only if credentials are available)
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Phone number validation
const validatePhoneNumber = (phoneNumber) => {
  try {
    if (!isValidPhoneNumber(phoneNumber)) {
      return { isValid: false, error: "Invalid phone number format" };
    }

    const parsedNumber = parsePhoneNumber(phoneNumber);
    return {
      isValid: true,
      formattedNumber: parsedNumber.format("E.164"),
      countryCode: parsedNumber.country,
      nationalNumber: parsedNumber.nationalNumber,
    };
  } catch (error) {
    return { isValid: false, error: "Phone number validation failed" };
  }
};

// Send SMS OTP via Twilio
const sendSMSOTP = async (phoneNumber, otp) => {
  try {
    if (!twilioClient) {
      throw new Error("SMS provider not configured (missing Twilio credentials)");
    }
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const message = await twilioClient.messages.create({
      body: `Your OjestSell verification code is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: validation.formattedNumber,
    });

    console.log(
      `SMS sent successfully to ${validation.formattedNumber}, SID: ${message.sid}`
    );
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error("SMS sending error:", error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

// Send Email OTP via Nodemailer
const sendEmailOTP = async (email, otp) => {
  try {
    if (!emailTransporter) {
      throw new Error("Email provider not configured (missing EMAIL_USER/EMAIL_PASS)");
    }
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OjestSell - Email Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">OjestSell Email Verification</h2>
          <p>Hello!</p>
          <p>Your email verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code is valid for 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from OjestSell. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log(
      `${otp} Email sent successfully to ${email}, Message ID: ${info.messageId}`
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Send OTP based on contact type
const sendOTP = async (contact, otp, type = "phone") => {
  try {
    if (type === "phone") {
      return await sendSMSOTP(contact, otp);
    } else if (type === "email") {
      return await sendEmailOTP(contact, otp);
    } else {
      throw new Error("Invalid contact type");
    }
  } catch (error) {
    console.error(`OTP sending error for ${type}:`, error);
    throw error;
  }
};

module.exports = {
  validatePhoneNumber,
  sendSMSOTP,
  sendEmailOTP,
  sendOTP,
};
