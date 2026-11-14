

import { Router } from "express";
import { body, validationResult } from "express-validator";

import {
  register,
  login,
  getMe,
  verifyEmail,
} from "../controllers/auth.controller.js";

import { authUser } from "../middleware/auth.middleware.js";

const AuthRouter = Router();

// Return validation errors
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  next();
};

// Registration validation
const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must be between 2 and 80 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/[A-Za-z]/)
    .withMessage("Password must contain at least one letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),

  checkValidation,
];

// Login validation
const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),

  checkValidation,
];

// Authentication routes
AuthRouter.post("/register", registerValidation, register);
AuthRouter.post("/login", loginValidation, login);
AuthRouter.get("/get-me", authUser, getMe);
AuthRouter.get("/verify-email", verifyEmail);

export default AuthRouter;