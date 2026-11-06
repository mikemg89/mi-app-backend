import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { isUniqueConstraintError } from "../utils/prismaErrors";

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L): los códigos se dictan por voz.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/** Acepta "abcd-1234", " ABCD1234 " o "abcd 1234" y devuelve "ABCD1234". */
export function normalizeInviteCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

export interface CreatedInvite {
  code: string;
  expiresAt: Date;
}

/**
 * Crea `count` invitaciones de un solo uso.
 * Reintenta si el código generado colisiona con uno existente.
 */
export async function createInvites(
  count: number,
  expiresInDays: number,
  createdBy?: string,
): Promise<CreatedInvite[]> {
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const created: CreatedInvite[] = [];

  for (let i = 0; i < count; i += 1) {
    let saved = false;

    for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
      try {
        const invite = await prisma.invite.create({
          data: { code: generateInviteCode(), expiresAt, createdBy },
        });
        created.push({ code: invite.code, expiresAt: invite.expiresAt });
        saved = true;
      } catch (error) {
        if (!isUniqueConstraintError(error) || attempt === 4) {
          throw error;
        }
      }
    }
  }

  return created;
}

/** Códigos usados o vencidos, para auditoría del administrador. */
export async function inviteStats() {
  const invites = await prisma.invite.findMany({
    where: { expiresAt: { gt: new Date() } },
  });

  return {
    available: invites.filter((invite) => invite.usedById === null).length,
    used: invites.filter((invite) => invite.usedById !== null).length,
  };
}
