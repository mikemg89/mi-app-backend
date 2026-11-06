// Crea un código de invitación directamente en la base de datos.
// Uso: npm run invite [díasDeVigencia]
const path = require("path");
const crypto = require("crypto");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

function connectionString(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("schema");
    return parsed.toString();
  } catch {
    return url;
  }
}

(async () => {
  const days = Number(process.argv[2] ?? 7);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const code = generateCode();

  const client = new Client({
    connectionString: connectionString(process.env.DATABASE_URL),
  });

  await client.connect();

  try {
    await client.query(
      'INSERT INTO "Invite" ("id", "code", "expiresAt") VALUES ($1, $2, $3)',
      [crypto.randomUUID(), code, expiresAt],
    );
    console.log(code);
    console.log(`Vigente hasta: ${expiresAt.toISOString()}`);
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error("No se pudo crear la invitación:", error.message);
  process.exit(1);
});
