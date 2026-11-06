import { env } from "./config/env";
import app from "./app";
import { prisma } from "./lib/prisma";
import { purgeOldVideos } from "./services/videoStorage";
import { startTelegramPolling, telegramEnabled } from "./services/telegram";

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${env.PORT}`);
  console.log(`🛡️  Entorno: ${env.NODE_ENV}`);

  void purgeOldVideos()
    .then((removed) => {
      if (removed > 0) {
        console.log(`🧹 ${removed} video(s) vencidos eliminados`);
      }
    })
    .catch((error) => console.error("Error limpiando videos:", error));

  if (telegramEnabled()) {
    void startTelegramPolling();
  } else {
    console.log(
      "📭 Telegram deshabilitado (faltan TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID)",
    );
  }
});

server.on("error", (error) => {
  console.error("Error al iniciar el servidor:", error);
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`\n${signal} recibido. Cerrando servidor...`);

  const forceExit = setTimeout(() => {
    console.error("Cierre forzado por timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      console.error("Error cerrando el servidor HTTP:", error);
    }

    try {
      await prisma.$disconnect();
    } catch (dbError) {
      console.error("Error cerrando Prisma:", dbError);
    } finally {
      clearTimeout(forceExit);
      process.exit(error ? 1 : 0);
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
