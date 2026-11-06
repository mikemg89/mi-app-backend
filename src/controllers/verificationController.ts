import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import {
  createChallenge,
  attachVideo,
  reviewVerification,
  latestVerification,
  type ReviewDecision,
} from "../services/verification";
import { notifyNewVideo } from "../services/telegram";

/** Paso 1: el servidor emite el código que el usuario debe decir en el video. */
export const createVerificationChallenge = async (
  req: Request,
  res: Response,
) => {
  const userId = req.auth?.id;
  if (!userId) {
    throw new ApiError(401, "UNAUTHORIZED", "Token requerido");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "Usuario no encontrado");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(
      403,
      "NOT_VERIFIED",
      "Debes verificar tu correo antes de continuar",
    );
  }

  if (user.videoStatus === "APPROVED") {
    throw new ApiError(
      409,
      "ALREADY_VERIFIED",
      "Tu video ya fue aprobado",
    );
  }

  const record = await createChallenge(userId);

  return res.status(201).json({
    verificationId: record.id,
    code: record.challenge,
    expiresAt: record.expiresAt,
  });
};

/** Paso 2: subida binaria del video (Content-Type video/*, cuerpo = archivo). */
export const uploadVerificationVideo = async (req: Request, res: Response) => {
  const userId = req.auth?.id;
  if (!userId) {
    throw new ApiError(401, "UNAUTHORIZED", "Token requerido");
  }

  const verificationId = req.header("x-verification-id");
  if (!verificationId) {
    throw new ApiError(
      400,
      "MISSING_VERIFICATION_ID",
      "Falta la cabecera x-verification-id",
    );
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ApiError(400, "EMPTY_BODY", "El cuerpo de la petición está vacío");
  }

  const record = await attachVideo(userId, verificationId, req.body);

  // El envío a Telegram no bloquea la respuesta: si falla, el video sigue
  // pendiente y se puede revisar con la clave de administración.
  void notifyNewVideo(record).catch((error) =>
    console.error("[verification] no se pudo notificar a Telegram:", error),
  );

  return res.status(202).json({
    verificationId: record.id,
    status: record.status,
    message: "Video recibido. Queda pendiente de revisión.",
  });
};

export const getVerificationStatus = async (req: Request, res: Response) => {
  const userId = req.auth?.id;
  if (!userId) {
    throw new ApiError(401, "UNAUTHORIZED", "Token requerido");
  }

  const [user, verification] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { videoStatus: true },
    }),
    latestVerification(userId),
  ]);

  return res.status(200).json({
    videoStatus: user?.videoStatus ?? "NONE",
    verification: verification
      ? {
          id: verification.id,
          status: verification.status,
          createdAt: verification.createdAt,
          reviewedAt: verification.reviewedAt,
          reason: verification.reason,
        }
      : null,
  });
};

/** Revisión manual desde el panel de administración (o el bot de Telegram). */
export const reviewVerificationHandler = async (
  req: Request,
  res: Response,
) => {
  const { verificationId, decision, reason } = (req.body ?? {}) as {
    verificationId?: string;
    decision?: ReviewDecision;
    reason?: string;
  };

  if (!verificationId || (decision !== "APPROVED" && decision !== "REJECTED")) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Se espera { verificationId, decision: APPROVED | REJECTED }",
    );
  }

  const updated = await reviewVerification(
    verificationId,
    decision,
    "admin",
    reason,
  );

  return res.status(200).json({
    verificationId: updated.id,
    status: updated.status,
  });
};
