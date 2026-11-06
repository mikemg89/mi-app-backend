// src/routes/adminRoutes.ts
import { Router } from "express";
import {
  createInviteBatch,
  getInviteStats,
} from "../controllers/adminController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Protegido con la cabecera x-admin-key (ADMIN_API_KEY)
router.post("/invites", asyncHandler(createInviteBatch));
router.get("/invites/stats", asyncHandler(getInviteStats));

export default router;
