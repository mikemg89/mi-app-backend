// src/routes/authRoutes.ts
import { Router } from "express";
import {
  register,
  login,
  verifyEmail,
  resendOtp,
} from "../controllers/authController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Registro cerrado por invitación (ADR-009)
router.post("/register", asyncHandler(register));
router.post("/verify-email", asyncHandler(verifyEmail));
router.post("/resend-otp", asyncHandler(resendOtp));
router.post("/login", asyncHandler(login));

export default router;
