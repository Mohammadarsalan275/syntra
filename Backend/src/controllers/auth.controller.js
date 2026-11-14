

import userModel from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../service/mail.service.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.jwt_secret;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

// Register a new user
export async function register(req, res) {
  let newUser;
  let isNewUser = false;

  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await userModel.findOne({
      email: normalizedEmail,
    });

    if (existingUser?.isVerified) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    if (existingUser) {
      newUser = existingUser;
    } else {
      isNewUser = true;
      newUser = await userModel.create({
        name,
        email: normalizedEmail,
        password,
        isVerified: false,
      });
    }

    const token = jwt.sign(
      {
        id: newUser._id.toString(),
        email: newUser.email,
        purpose: "email-verification",
      },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    const apiUrl =
      process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;

    const verifyUrl =
      `${apiUrl.replace(/\/$/, "")}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await sendEmail({
        to: newUser.email,
        subject: "Welcome to Nexora - Verify your email",
        text: `Hello ${newUser.name},

Thank you for registering on Nexora.

Verify your email using this link:
${verifyUrl}

This link expires in 24 hours.`,
        html: `
        <h2>Welcome to Nexora, ${escapeHtml(newUser.name)}!</h2>
        <p>Thank you for registering.</p>
        <p>Click the link below to verify your email:</p>
        <a href="${verifyUrl}">Verify my email</a>
        <p>This link expires in 24 hours.</p>
      `,
      });
    } catch (error) {
      console.error("Verification email delivery failed:", error);
      if (isNewUser) {
        try {
          await userModel.deleteOne({ _id: newUser._id });
        } catch (cleanupError) {
          console.error(
            "Failed to remove unverified user after email failure:",
            cleanupError,
          );
        }
      }

      return res.status(503).json({
        success: false,
        message:
          "Could not send the verification email. Check the mail settings and try registering again.",
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email to verify your account.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isVerified: newUser.isVerified,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while registering the user",
    });
  }
}

// Log in an existing user
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
      },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while logging in",
    });
  }
}

// Verify the user's email
export async function verifyEmail(req, res) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).send("Verification token is required.");
    }

    const decoded = jwt.verify(token, getJwtSecret());

    if (
      decoded.purpose !== "email-verification" ||
      !decoded.id ||
      !decoded.email
    ) {
      return res.status(400).send("Invalid verification token.");
    }

    const user = await userModel.findOne({
      _id: decoded.id,
      email: decoded.email,
    });

    if (!user) {
      return res.status(404).send("User not found.");
    }

    if (user.isVerified) {
      return res.send(`
        <h1>Email already verified</h1>
        <p>Your email address has already been verified.</p>
      `);
    }

    user.isVerified = true;
    await user.save();

    return res.send(`
      <h1>Email verified successfully!</h1>
      <p>Thank you for verifying your email.</p>
      <p>You can now log in to your account.</p>
    `);
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(400).send(
        "The verification link is invalid or has expired."
      );
    }

    console.error("Email verification error:", error.message);

    return res.status(500).send(
      "Something went wrong during email verification."
    );
  }
}

// Get the currently authenticated user
export async function getMe(req, res) {
  try {
    const user = await userModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get-me error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
}