// src/controllers/authController.ts
import type { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
} from "../utils/validators";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/jwt";
import {
  isUniqueConstraintError,
  uniqueConstraintTarget,
} from "../utils/prismaErrors";
import { ApiError } from "../utils/apiError";
import { issueOtp, consumeOtp } from "../services/otp";
import { normalizeInviteCode } from "../services/invites";

const badRequest = (res: Response, message?: string) => {
  return res
    .status(400)
    .json({ error: message ?? "Datos inválidos", code: "VALIDATION" });
};

/**
 * Registro cerrado: sin invitación válida no se crea la cuenta (ADR-009).
 * La cuenta nace en PENDING_VERIFICATION y no puede iniciar sesión hasta
 * confirmar el OTP del correo.
 */
export const register = async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message);
  }

  const { email, password, phoneNumber } = parsed.data;
  const inviteCode = normalizeInviteCode(parsed.data.inviteCode);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res
      .status(409)
      .json({ error: "El email ya está registrado", code: "EMAIL_TAKEN" });
  }

  if (phoneNumber) {
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNumber },
    });
    if (existingPhone) {
      return res
        .status(409)
        .json({ error: "El teléfono ya está registrado", code: "PHONE_TAKEN" });
    }
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    // Crear la cuenta y consumir la invitación son una sola operación:
    // si la invitación ya no está disponible, no queda un usuario huérfano.
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, phoneNumber },
      });

      const claimed = await tx.invite.updateMany({
        where: {
          code: inviteCode,
          usedById: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedById: created.id, usedAt: new Date() },
      });

      if (claimed.count === 0) {
        throw new ApiError(
          400,
          "INVALID_INVITE",
          "Código de invitación inválido, usado o vencido",
        );
      }

      return created;
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.status)
        .json({ error: error.message, code: error.code });
    }

    if (isUniqueConstraintError(error)) {
      const target = uniqueConstraintTarget(error);
      const isPhone = target?.toLowerCase().includes("phone");
      return res.status(409).json({
        error: isPhone
          ? "El teléfono ya está registrado"
          : "El email ya está registrado",
        code: isPhone ? "PHONE_TAKEN" : "EMAIL_TAKEN",
      });
    }

    throw error;
  }

  await issueOtp(user);

  return res.status(201).json({
    message: "Cuenta creada. Revisa tu correo para verificarla.",
    userId: user.id,
    status: user.status,
  });
};

/** Confirma el OTP y activa la cuenta. */
export const verifyEmail = async (req: Request, res: Response) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message);
  }

  const { email, code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res
      .status(400)
      .json({ error: "Código inválido o vencido", code: "INVALID_OTP" });
  }

  if (user.status === "ACTIVE") {
    return res
      .status(409)
      .json({ error: "La cuenta ya está verificada", code: "ALREADY_VERIFIED" });
  }

  const result = await consumeOtp(user.id, code);

  if (result === "expired") {
    return res.status(400).json({
      error: "El código venció. Pide uno nuevo.",
      code: "OTP_EXPIRED",
    });
  }

  if (result === "locked") {
    return res.status(429).json({
      error: "Demasiados intentos. Pide un código nuevo.",
      code: "OTP_LOCKED",
    });
  }

  if (result !== "ok") {
    return res
      .status(400)
      .json({ error: "Código inválido", code: "INVALID_OTP" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE", emailVerifiedAt: new Date() },
  });

  return res
    .status(200)
    .json({ message: "Cuenta verificada", status: "ACTIVE" });
};

/** Reenvía el OTP. La respuesta es siempre la misma para no filtrar cuentas. */
export const resendOtp = async (req: Request, res: Response) => {
  const parsed = resendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message);
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (user && user.status === "PENDING_VERIFICATION") {
    await issueOtp(user);
  }

  return res.status(200).json({
    message: "Si el correo está registrado, enviamos un nuevo código",
  });
};

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message);
  }

  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    // Mensaje genérico para no revelar si el email existe (seguridad)
    return res
      .status(401)
      .json({ error: "Credenciales inválidas", code: "INVALID_CREDENTIALS" });
  }

  const isValidPassword = await verifyPassword(
    user.passwordHash,
    data.password,
  );
  if (!isValidPassword) {
    return res
      .status(401)
      .json({ error: "Credenciales inválidas", code: "INVALID_CREDENTIALS" });
  }

  // Solo las cuentas con el correo confirmado pueden iniciar sesión.
  if (user.status !== "ACTIVE") {
    return res.status(403).json({
      error:
        "Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.",
      code: "NOT_VERIFIED",
    });
  }

  const familyId = crypto.randomUUID(); // ID de familia para esta sesión
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, familyId);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      familyId,
      expiresAt,
    },
  });

  return res.status(200).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
};
