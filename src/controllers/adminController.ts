import type { Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { createInvites, inviteStats } from "../services/invites";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Autoriza con la cabecera `x-admin-key`. Sin clave configurada, todo se cierra. */
function isAuthorized(req: Request): boolean {
  if (!env.ADMIN_API_KEY) {
    return false;
  }
  return safeEqual(req.header("x-admin-key") ?? "", env.ADMIN_API_KEY);
}

export const createInviteBatch = async (req: Request, res: Response) => {
  if (!env.ADMIN_API_KEY) {
    return res.status(503).json({
      error: "Administración deshabilitada: falta ADMIN_API_KEY",
      code: "ADMIN_DISABLED",
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "No autorizado", code: "UNAUTHORIZED" });
  }

  const rawCount = Number((req.body as { count?: unknown })?.count ?? 1);
  const rawDays = Number(
    (req.body as { expiresInDays?: unknown })?.expiresInDays ?? 7,
  );

  const count = Math.min(Math.max(Number.isFinite(rawCount) ? rawCount : 1, 1), 20);
  const expiresInDays = Math.min(
    Math.max(Number.isFinite(rawDays) ? rawDays : 7, 1),
    90,
  );

  const invites = await createInvites(count, expiresInDays, "admin");

  return res.status(201).json({ invites });
};

export const getInviteStats = async (req: Request, res: Response) => {
  if (!env.ADMIN_API_KEY) {
    return res.status(503).json({
      error: "Administración deshabilitada: falta ADMIN_API_KEY",
      code: "ADMIN_DISABLED",
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "No autorizado", code: "UNAUTHORIZED" });
  }

  return res.status(200).json(await inviteStats());
};
