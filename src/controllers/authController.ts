// src/controllers/authController.ts
import type { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import { registerSchema, loginSchema } from "../utils/validators";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/jwt";
import {
  isUniqueConstraintError,
  uniqueConstraintTarget,
} from "../utils/prismaErrors";

const badRequest = (res: Response, message?: string) => {
  return res.status(400).json({ error: message ?? "Datos inválidos" });
};

export const register = async (req: Request, res: Response) => {
  // 1. Validar los datos de entrada (Zod 4 usa `issues`, no `errors`)
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message);
  }

  const data = parsed.data;

  // 2. Verificar si el email ya existe (comprobación amigable)
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingUser) {
    return res.status(409).json({ error: "El email ya está registrado" });
  }

  // 3. Verificar si el teléfono ya existe (solo si se envió)
  if (data.phoneNumber) {
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNumber: data.phoneNumber },
    });
    if (existingPhone) {
      return res.status(409).json({ error: "El teléfono ya está registrado" });
    }
  }

  // 4. Hashear la contraseña
  const passwordHash = await hashPassword(data.password);

  // 5. Crear el usuario. Si dos peticiones compiten, Prisma devuelve P2002
  //    y lo traducimos a 409 en lugar de 500.
  try {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        phoneNumber: data.phoneNumber,
      },
    });

    return res.status(201).json({
      message: "Usuario registrado exitosamente",
      userId: user.id,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const target = uniqueConstraintTarget(error);
      const message =
        target && target.toLowerCase().includes("phone")
          ? "El teléfono ya está registrado"
          : "El email ya está registrado";

      return res.status(409).json({ error: message });
    }

    // Los errores desconocidos los maneja el middleware central.
    throw error;
  }
};

export const login = async (req: Request, res: Response) => {
  // 1. Validar datos
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message);
  }

  const data = parsed.data;

  // 2. Buscar usuario (el email ya viene normalizado)
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    // Mensaje genérico para no revelar si el email existe (seguridad)
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  // 3. Verificar contraseña
  const isValidPassword = await verifyPassword(
    user.passwordHash,
    data.password,
  );
  if (!isValidPassword) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  // 4. Generar tokens
  const familyId = crypto.randomUUID(); // ID de familia para esta sesión
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, familyId);

  // 5. Guardar el HASH del refresh token en la base de datos
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

  // 6. Devolver los tokens al cliente
  return res.status(200).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
};
