import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { mailer } from "./mailer";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

// Clave derivada del secreto de acceso: nunca se usa el secreto JWT en crudo
// para otra función criptográfica.
const OTP_KEY = crypto
  .createHash("sha256")
  .update(`${env.JWT_ACCESS_SECRET}|email-otp|v1`)
  .digest();

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(userId: string, code: string): string {
  return crypto
    .createHmac("sha256", OTP_KEY)
    .update(`${userId}:${code}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Genera un OTP nuevo e invalida los anteriores.
 * El código en claro solo existe en memoria: se envía por correo y se guarda hasheado.
 */
export async function issueOtp(user: {
  id: string;
  email: string;
}): Promise<void> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.emailOtp.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailOtp.create({
    data: {
      userId: user.id,
      codeHash: hashOtpCode(user.id, code),
      expiresAt,
    },
  });

  await mailer.send({
    to: user.email,
    subject: "Tu código de verificación",
    text:
      `Tu código de verificación es ${code}.\n\n` +
      `Caduca en ${OTP_TTL_MINUTES} minutos.\n\n` +
      `Si no creaste una cuenta, ignora este mensaje.`,
  });
}

export type OtpResult = "ok" | "invalid" | "expired" | "locked";

/**
 * Verifica y consume el OTP vigente del usuario.
 * Cuenta los intentos fallidos para frenar la fuerza bruta del código de 6 dígitos.
 */
export async function consumeOtp(
  userId: string,
  code: string,
): Promise<OtpResult> {
  const otp = await prisma.emailOtp.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return "invalid";
  }

  if (otp.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return "locked";
  }

  if (!safeEqualHex(otp.codeHash, hashOtpCode(userId, code))) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }

  const consumed = await prisma.emailOtp.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  return consumed.count === 1 ? "ok" : "invalid";
}
