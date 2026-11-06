import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Autoriza con la cabecera `x-admin-key`.
 * Sin clave configurada, todo lo administrativo queda cerrado (503).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!env.ADMIN_API_KEY) {
    return res.status(503).json({
      error: "Administración deshabilitada: falta ADMIN_API_KEY",
      code: "ADMIN_DISABLED",
    });
  }

  if (!safeEqual(req.header("x-admin-key") ?? "", env.ADMIN_API_KEY)) {
    return res.status(401).json({ error: "No autorizado", code: "UNAUTHORIZED" });
  }

  return next();
}
