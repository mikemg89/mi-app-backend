// Configura el bot de Telegram en .env sin tener que buscar el chat id a mano.
// Uso:  npm run telegram:setup -- <TOKEN>
//
// Pasos:
//   1. Valida el token con getMe.
//   2. Lee getUpdates para descubrir el chat id (tienes que haberle escrito al bot).
//   3. Escribe TELEGRAM_BOT_TOKEN y TELEGRAM_ADMIN_CHAT_ID en .env.
//   4. Envía un mensaje de prueba al chat.
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

async function api(token, method, init) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.ok !== true) {
    const description = body.description ?? `HTTP ${response.status}`;

    if (response.status === 409) {
      fail(
        "El servidor del backend está corriendo y ya está escuchando el bot.\n" +
          "   Detén `npm run dev` (Ctrl+C) y vuelve a ejecutar este script.",
      );
    }

    fail(`Telegram rechazó ${method}: ${description}`);
  }

  return body.result;
}

function upsertEnv(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  const suffix = contents.endsWith("\n") || contents.length === 0 ? "" : "\n";
  return `${contents}${suffix}${line}\n`;
}

(async () => {
  const token = (process.argv[2] ?? "").trim();

  if (!token) {
    fail(
      "Falta el token.\n" +
        "   Uso: npm run telegram:setup -- 123456789:AAH...\n" +
        "   Lo obtuviste de @BotFather con /newbot.",
    );
  }

  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
    fail("El token no tiene el formato esperado (123456789:AAH...).");
  }

  console.log("→ Validando el token…");
  const me = await api(token, "getMe");
  console.log(`  Bot: @${me.username} (${me.first_name})`);

  console.log("→ Buscando tu chat id…");
  const updates = await api(token, "getUpdates?limit=20&timeout=0");

  const chats = [];
  for (const update of updates) {
    const message = update.message ?? update.edited_message;
    if (message?.chat) {
      chats.push(message.chat);
    }
  }

  if (chats.length === 0) {
    fail(
      "No encontré ningún mensaje tuyo.\n" +
        "   Abre Telegram, busca el bot, pulsa INICIAR (/start) y envíale cualquier mensaje.\n" +
        "   Después vuelve a ejecutar el script.",
    );
  }

  const privateChat = [...chats].reverse().find((chat) => chat.type === "private") ?? chats.at(-1);
  const chatId = String(privateChat.id);

  console.log(`  Chat: ${privateChat.first_name ?? privateChat.title ?? "?"} (id ${chatId})`);

  if (!fs.existsSync(ENV_PATH)) {
    fail("No existe `mi-app-backend/.env`. Créalo desde .env.example primero.");
  }

  let contents = fs.readFileSync(ENV_PATH, "utf8");
  contents = upsertEnv(contents, "TELEGRAM_BOT_TOKEN", token);
  contents = upsertEnv(contents, "TELEGRAM_ADMIN_CHAT_ID", chatId);
  fs.writeFileSync(ENV_PATH, contents, "utf8");

  console.log("→ Enviando mensaje de prueba…");
  await api(token, "sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "✅ DateApp conectado. Aquí llegarán los videos de verificación.",
    }),
  });

  console.log("\n✅ Listo. Variables escritas en .env:");
  console.log(`   TELEGRAM_BOT_TOKEN=${token.slice(0, 12)}…`);
  console.log(`   TELEGRAM_ADMIN_CHAT_ID=${chatId}`);
  console.log("\nReinicia el backend con `npm run dev`.\n");
})().catch((error) => {
  fail(`Error inesperado: ${error.message}`);
});
