import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthUser {
  id: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

function unauthorized(res: Response, message: string, code: string) {
  return res.status(401).json({ error: message, code });
}

/** Exige un access token válido en `Authorization: Bearer <token>`. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (!token || scheme?.toLowerCase() !== "bearer") {
    return unauthorized(res, "Token requerido", "UNAUTHORIZED");
  }

  try {
    const decoded = verifyAccessToken(token);

    if (typeof decoded === "string" || typeof decoded.id !== "string") {
      return unauthorized(res, "Token inválido", "INVALID_TOKEN");
    }

    req.auth = {
      id: decoded.id,
      role: typeof decoded.role === "string" ? decoded.role : "USER",
    };
    return next();
  } catch {
    return unauthorized(res, "Token inválido o vencido", "INVALID_TOKEN");
  }
}
