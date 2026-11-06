import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET debe tener al menos 32 caracteres"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET debe tener al menos 32 caracteres"),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.string().optional(),

  // Envío de correo. "console" imprime el mensaje en la terminal (desarrollo);
  // "memory" guarda los envíos en memoria (tests). El driver SMTP/Resend se
  // añade cuando haya dominio verificado.
  MAIL_DRIVER: z.enum(["console", "memory"]).default("console"),

  // Clave para el endpoint de administración (crear invitaciones).
  // Si no se define, el endpoint queda deshabilitado.
  ADMIN_API_KEY: z.string().min(32).optional(),

  // Bot de Telegram para revisar los videos de verificación.
  // Si falta cualquiera de las dos, el envío se omite y el video queda
  // PENDING_REVIEW para revisarlo con la clave de administración.
  TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().min(1).optional(),

  // Directorio donde se guardan los videos temporales (se borran al revisar).
  UPLOAD_DIR: z.string().default("uploads"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Variables de entorno inválidas:\n${details}`);
}

export const env = parsed.data;
