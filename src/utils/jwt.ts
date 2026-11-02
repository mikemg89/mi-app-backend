// src/utils/jwt.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";

const ACCESS_SECRET = env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = env.JWT_REFRESH_SECRET;

// 1. Generar Access Token (Vive poco: 15 minutos)
export const generateAccessToken = (userId: string, role: string) => {
  return jwt.sign({ id: userId, role }, ACCESS_SECRET, { expiresIn: "15m" });
};

// 2. Generar Refresh Token (Vive más: 7 días)
export const generateRefreshToken = (userId: string, familyId: string) => {
  return jwt.sign({ id: userId, familyId }, REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

// 3. Hashear el Refresh Token antes de guardarlo en la Base de Datos
// (NUNCA guardes el token real en la BD por si hay una filtración)
export const hashToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// 4. Verificar un Access Token
export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_SECRET);
};
