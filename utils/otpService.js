const { parsePhoneNumber, isValidPhoneNumber } = require("libphonenumber-js");
const twilio = require("twilio");
const { Resend } = require("resend");

// Initialize Twilio client (only if credentials are available)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Initialize Resend client (preferred email provider)
let resendClient = null;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM;
if (RESEND_API_KEY) {
  resendClient = new Resend(RESEND_API_KEY);
}
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ojest.pl";
// const APP_BASE_URL = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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

// Send Email OTP via Resend
const sendEmailOTP = async (email, otp) => {
  try {
    if (!resendClient) {
      throw new Error("Email provider not configured (missing RESEND_API_KEY)");
    }
    const html = `
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
    `;

    const { data, error } = await resendClient.emails.send({
      from: RESEND_FROM || "Ojest <send@ojest.pl>",
      to: [email],
      subject: "OjestSell - Email Verification Code",
      html,
    });
    if (error) {
      throw new Error(error.message || "Resend send failed");
    }
    console.log(`${otp} Email sent successfully to ${email}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
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
  // extra mailers will be appended by further export additions below
};

// Additional transactional emails via Resend
const sendApprovalEmail = async (email, { firstName = "" } = {}) => {
  if (!resendClient) throw new Error("Email provider not configured (missing RESEND_API_KEY)");
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">OjestSell - Account Approved</h2>
      <p>Hi ${firstName || "there"},</p>
      <p>Your account has been approved. You can now sign in and start using OjestSell.</p>
      <p><a href="${APP_BASE_URL}/sign-in" style="background:#16a34a;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">Sign in</a></p>
    </div>
  `;
  const { data, error } = await resendClient.emails.send({
    from: RESEND_FROM || "Ojest <send@ojest.pl>",
    to: [email],
    subject: "Your OjestSell account is approved",
    html,
  });
  if (error) throw new Error(error.message || "Resend send failed");
  return { success: true, messageId: data?.id };
};

const sendRejectionEmail = async (email, { firstName = "", reason = "" } = {}) => {
  if (!resendClient) throw new Error("Email provider not configured (missing RESEND_API_KEY)");
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">OjestSell - Registration Update</h2>
      <p>Hi ${firstName || "there"},</p>
      <p>We’re sorry, but your account was not approved at this time.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ""}
      <p>If you believe this was a mistake, you can reply to this email.</p>
    </div>
  `;
  const { data, error } = await resendClient.emails.send({
    from: RESEND_FROM || "Ojest <send@ojest.pl>",
    to: [email],
    subject: "OjestSell registration status",
    html,
  });
  if (error) throw new Error(error.message || "Resend send failed");
  return { success: true, messageId: data?.id };
};

const sendPasswordResetEmail = async (email, token) => {
  if (!resendClient) throw new Error("Email provider not configured (missing RESEND_API_KEY)");
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Reset your OjestSell password</h2>
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>This link will expire in 60 minutes. If you didn’t request this, you can safely ignore this email.</p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p>${resetUrl}</p>
    </div>
  `;
  const { data, error } = await resendClient.emails.send({
    from: RESEND_FROM || "Ojest <send@ojest.pl>",
    to: [email],
    subject: "Reset your OjestSell password",
    html,
  });
  if (error) throw new Error(error.message || "Resend send failed");
  return { success: true, messageId: data?.id };
};

module.exports.sendApprovalEmail = sendApprovalEmail;
module.exports.sendRejectionEmail = sendRejectionEmail;
module.exports.sendPasswordResetEmail = sendPasswordResetEmail;
