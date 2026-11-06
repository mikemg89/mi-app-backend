import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { detectVideoKind, saveVideo, deleteVideo } from "./videoStorage";

export const CHALLENGE_TTL_MINUTES = 15;
const FILE_TTL_DAYS = 7;

export type ReviewDecision = "APPROVED" | "REJECTED";

/**
 * Crea un desafío nuevo. El código lo genera el servidor y se muestra en pantalla
 * mientras la persona graba: así un video pregrabado no sirve.
 */
export async function createChallenge(userId: string) {
  // Un solo desafío vivo por usuario.
  await prisma.videoVerification.updateMany({
    where: { userId, status: "AWAITING_UPLOAD" },
    data: { status: "EXPIRED" },
  });

  const challenge = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000);

  return prisma.videoVerification.create({
    data: { userId, challenge, expiresAt },
  });
}

export async function attachVideo(
  userId: string,
  verificationId: string,
  buffer: Buffer,
) {
  const record = await prisma.videoVerification.findUnique({
    where: { id: verificationId },
  });

  if (!record || record.userId !== userId) {
    throw new ApiError(
      404,
      "VERIFICATION_NOT_FOUND",
      "Verificación no encontrada",
    );
  }

  if (record.status !== "AWAITING_UPLOAD") {
    throw new ApiError(
      409,
      "VERIFICATION_STATE",
      "Esta verificación ya no acepta un video",
    );
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.videoVerification.update({
      where: { id: record.id },
      data: { status: "EXPIRED" },
    });
    throw new ApiError(
      410,
      "CHALLENGE_EXPIRED",
      "El código venció. Solicita uno nuevo.",
    );
  }

  const kind = detectVideoKind(buffer);
  if (!kind) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA",
      "El archivo no es un video válido (MP4 o WebM)",
    );
  }

  const saved = await saveVideo(userId, verificationId, buffer, kind);
  const purgeAt = new Date(Date.now() + FILE_TTL_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.videoVerification.update({
      where: { id: record.id },
      data: {
        status: "PENDING_REVIEW",
        storagePath: saved.storagePath,
        mimeType: kind === "mp4" ? "video/mp4" : "video/webm",
        sizeBytes: saved.sizeBytes,
        uploadedAt: new Date(),
        purgeAt,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { videoStatus: "PENDING" },
    });

    return updated;
  });
}

export async function reviewVerification(
  verificationId: string,
  decision: ReviewDecision,
  reviewer: string,
  reason?: string,
) {
  const record = await prisma.videoVerification.findUnique({
    where: { id: verificationId },
  });

  if (!record) {
    throw new ApiError(
      404,
      "VERIFICATION_NOT_FOUND",
      "Verificación no encontrada",
    );
  }

  if (record.status !== "PENDING_REVIEW") {
    throw new ApiError(
      409,
      "VERIFICATION_STATE",
      "Esta verificación no está pendiente de revisión",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const verification = await tx.videoVerification.update({
      where: { id: record.id },
      data: {
        status: decision,
        reviewedAt: new Date(),
        reviewedBy: reviewer,
        reason: reason ?? null,
      },
    });

    await tx.user.update({
      where: { id: record.userId },
      data: { videoStatus: decision },
    });

    return verification;
  });

  // Retención: el video se borra en cuanto se revisa. Solo queda el metadato.
  await deleteVideo(record.storagePath);

  return updated;
}

export async function latestVerification(userId: string) {
  return prisma.videoVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
