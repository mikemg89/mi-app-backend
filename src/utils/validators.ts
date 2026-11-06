// src/utils/validators.ts
import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido")
  .max(254, "El email es demasiado largo");

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña no puede superar los 128 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[0-9]/, "Debe contener al menos un número");

const phoneNumberSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(
    z
      .string()
      .regex(/^\+?[0-9]{7,15}$/, "El teléfono debe tener entre 7 y 15 dígitos")
      .optional(),
  )
  .optional();

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  phoneNumber: phoneNumberSchema,
  inviteCode: z
    .string()
    .trim()
    .min(4, "El código de invitación es obligatorio")
    .max(40, "Código de invitación inválido"),
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "El código debe tener 6 dígitos"),
});

export const resendOtpSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "La contraseña es obligatoria")
    .max(128, "La contraseña no puede superar los 128 caracteres"),
});
