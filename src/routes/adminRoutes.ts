// src/routes/adminRoutes.ts
import { Router } from "express";
import {
  createInviteBatch,
  getInviteStats,
} from "../controllers/adminController";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

// Todo lo administrativo exige la cabecera x-admin-key (ADMIN_API_KEY)
router.use(requireAdmin);

router.post("/invites", asyncHandler(createInviteBatch));
router.get("/invites/stats", asyncHandler(getInviteStats));

export default router;
