// src/routes/verificationRoutes.ts
import { Router, raw } from "express";
import {
  createVerificationChallenge,
  uploadVerificationVideo,
  getVerificationStatus,
  reviewVerificationHandler,
} from "../controllers/verificationController";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

// 1. El servidor entrega el código que debe aparecer en el video.
router.post("/challenge", requireAuth, asyncHandler(createVerificationChallenge));

// 2. Subida binaria del video (sin multipart: el cuerpo ES el archivo).
router.post(
  "/video",
  requireAuth,
  raw({
    type: ["video/*", "application/octet-stream"],
    limit: "15mb",
  }),
  asyncHandler(uploadVerificationVideo),
);

// 3. Estado actual del usuario.
router.get("/status", requireAuth, asyncHandler(getVerificationStatus));

// 4. Revisión manual (el bot de Telegram usa el servicio directamente).
router.post("/review", requireAdmin, asyncHandler(reviewVerificationHandler));

export default router;
