import type { Request, Response } from "express";
import { createInvites, inviteStats } from "../services/invites";

// La autorización la aplica `requireAdmin` en la ruta.
export const createInviteBatch = async (req: Request, res: Response) => {
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

export const getInviteStats = async (_req: Request, res: Response) => {
  return res.status(200).json(await inviteStats());
};
