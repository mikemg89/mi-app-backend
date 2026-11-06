import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { reviewVerification } from "./verification";

interface ReviewableVideo {
  id: string;
  userId: string;
  challenge: string;
  storagePath: string | null;
  mimeType: string | null;
}

export function telegramEnabled(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID);
}

function endpoint(method: string): string {
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

/** Envía el video al administrador con los botones de aprobar / rechazar. */
export async function notifyNewVideo(record: ReviewableVideo): Promise<void> {
  if (!telegramEnabled()) {
    console.log(
      `[telegram] deshabilitado: la verificación ${record.id} queda PENDING_REVIEW`,
    );
    return;
  }

  if (!record.storagePath) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { email: true },
  });

  const file = await fs.readFile(path.resolve(process.cwd(), record.storagePath));

  const form = new FormData();
  form.set("chat_id", String(env.TELEGRAM_ADMIN_CHAT_ID));
  form.set(
    "caption",
    [
      "🎥 Verificación por video pendiente",
      `Usuario: ${user?.email ?? record.userId}`,
      `Código que debe decir en el video: ${record.challenge}`,
      `ID: ${record.id}`,
    ].join("\n"),
  );
  form.set(
    "reply_markup",
    JSON.stringify({
      inline_keyboard: [
        [
          { text: "✅ Aprobar", callback_data: `approve:${record.id}` },
          { text: "❌ Rechazar", callback_data: `reject:${record.id}` },
        ],
      ],
    }),
  );
  form.set(
    "video",
    new Blob([file], { type: record.mimeType ?? "video/mp4" }),
    `${record.id}.mp4`,
  );

  const response = await fetch(endpoint("sendVideo"), {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    console.error("[telegram] sendVideo falló:", await response.text());
  }
}

async function answerCallback(callbackId: string, text: string): Promise<void> {
  if (!telegramEnabled()) {
    return;
  }
  await fetch(endpoint("answerCallbackQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  }).catch(() => undefined);
}

async function markMessage(
  chatId: number | string,
  messageId: number,
  text: string,
): Promise<void> {
  if (!telegramEnabled()) {
    return;
  }
  await fetch(endpoint("editMessageCaption"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: text }),
  }).catch(() => undefined);
}

interface TelegramCallbackQuery {
  id: string;
  from?: { id: number };
  data?: string;
  message?: { chat: { id: number }; message_id: number };
}

async function handleCallback(query: TelegramCallbackQuery): Promise<void> {
  if (String(query.from?.id) !== String(env.TELEGRAM_ADMIN_CHAT_ID)) {
    await answerCallback(query.id, "No autorizado");
    return;
  }

  const [action, verificationId] = String(query.data ?? "").split(":");
  if (!verificationId || (action !== "approve" && action !== "reject")) {
    await answerCallback(query.id, "Acción no reconocida");
    return;
  }

  const decision = action === "approve" ? "APPROVED" : "REJECTED";

  try {
    await reviewVerification(
      verificationId,
      decision,
      `telegram:${query.from?.id}`,
    );

    await answerCallback(
      query.id,
      decision === "APPROVED" ? "Usuario aprobado" : "Usuario rechazado",
    );

    if (query.message) {
      await markMessage(
        query.message.chat.id,
        query.message.message_id,
        decision === "APPROVED"
          ? "✅ APROBADO — el perfil ya puede publicarse"
          : "❌ RECHAZADO — el usuario deberá volver a grabar",
      );
    }
  } catch (error) {
    await answerCallback(query.id, (error as Error).message.slice(0, 180));
  }
}

let polling = false;

/**
 * Escucha los botones del administrador con long polling.
 * Funciona detrás de NAT sin URL pública, que es justo el caso del MVP local.
 */
export async function startTelegramPolling(): Promise<void> {
  if (!telegramEnabled() || polling) {
    return;
  }

  polling = true;
  console.log("[telegram] escuchando aprobaciones del administrador");

  let offset = 0;

  while (polling) {
    try {
      const response = await fetch(
        `${endpoint("getUpdates")}?timeout=25&offset=${offset}`,
        { signal: AbortSignal.timeout(40_000) },
      );

      const payload = (await response.json()) as {
        ok: boolean;
        result?: Array<{ update_id: number; callback_query?: TelegramCallbackQuery }>;
      };

      for (const update of payload.result ?? []) {
        offset = update.update_id + 1;
        if (update.callback_query) {
          await handleCallback(update.callback_query).catch((error) =>
            console.error("[telegram] callback:", error),
          );
        }
      }
    } catch (error) {
      console.error("[telegram] polling:", (error as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

export function stopTelegramPolling(): void {
  polling = false;
}
