import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { memoryMailbox } from "../src/services/mailer";
import { generateInviteCode } from "../src/services/invites";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emailPrefix = `test-auth-${runId}`;
const email = (suffix: string) => `${emailPrefix}.${suffix}@example.com`;
const PASSWORD = "Password1";

const createdInvites: string[] = [];

/** Crea una invitación válida directamente en la base de datos. */
async function newInvite(): Promise<string> {
  const code = generateInviteCode();
  createdInvites.push(code);
  await prisma.invite.create({
    data: { code, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  return code;
}

/** Extrae el OTP del correo capturado en memoria. */
function otpFor(address: string): string {
  const message = memoryMailbox.lastTo(address);
  if (!message) {
    throw new Error(`No se envió correo a ${address}`);
  }
  const match = /(\d{6})/.exec(message.text);
  if (!match) {
    throw new Error("El correo no contiene un código de 6 dígitos");
  }
  return match[1];
}

async function registerUser(address: string, inviteCode?: string) {
  return request(app)
    .post("/api/auth/register")
    .send({ email: address, password: PASSWORD, inviteCode });
}

async function registerAndVerify(address: string) {
  const invite = await newInvite();
  const created = await registerUser(address, invite);
  expect(created.status).toBe(201);
  const verified = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: address, code: otpFor(address) });
  expect(verified.status).toBe(200);
}

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: emailPrefix } },
  });
  await prisma.invite.deleteMany({ where: { code: { in: createdInvites } } });
  await prisma.$disconnect();
});

describe("POST /api/auth/register — registro cerrado", () => {
  it("rechaza el registro sin invitación", async () => {
    const res = await registerUser(email("sin-invitacion"));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("rechaza un email inválido sin tumbar el servidor", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "no-es-email", password: PASSWORD, inviteCode: "AAAA1111" });

    expect(res.status).toBe(400);

    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
  });

  it("rechaza una contraseña débil", async () => {
    const invite = await newInvite();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: email("weak"), password: "abc", inviteCode: invite });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "La contraseña debe tener al menos 8 caracteres",
    );
  });

  it("rechaza una invitación inexistente", async () => {
    const res = await registerUser(email("invite-falsa"), "NOEXISTE");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_INVITE");
  });

  it("rechaza una invitación ya usada y no deja usuario huérfano", async () => {
    const invite = await newInvite();
    const first = await registerUser(email("invite-1"), invite);
    expect(first.status).toBe(201);

    const second = await registerUser(email("invite-2"), invite);
    expect(second.status).toBe(400);
    expect(second.body.code).toBe("INVALID_INVITE");

    const orphan = await prisma.user.findUnique({
      where: { email: email("invite-2") },
    });
    expect(orphan).toBeNull();
  });

  it("crea la cuenta en PENDING_VERIFICATION", async () => {
    const invite = await newInvite();
    const res = await registerUser(email("pendiente"), invite);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING_VERIFICATION");
    expect(res.body.userId).toBeTypeOf("string");
  });

  it("rechaza un email duplicado sin importar mayúsculas", async () => {
    const invite = await newInvite();
    await registerUser(email("duplicado"), invite);

    const invite2 = await newInvite();
    const res = await registerUser(`${emailPrefix}.DUPLICADO@EXAMPLE.COM`, invite2);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_TAKEN");
  });

  it("trata el teléfono vacío como ausente", async () => {
    const first = await request(app)
      .post("/api/auth/register")
      .send({
        email: email("phone-empty-1"),
        password: PASSWORD,
        phoneNumber: "",
        inviteCode: await newInvite(),
      });

    const second = await request(app)
      .post("/api/auth/register")
      .send({
        email: email("phone-empty-2"),
        password: PASSWORD,
        phoneNumber: "   ",
        inviteCode: await newInvite(),
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("rechaza un teléfono con formato inválido", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: email("phone-invalid"),
        password: PASSWORD,
        phoneNumber: "abc",
        inviteCode: await newInvite(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("El teléfono debe tener entre 7 y 15 dígitos");
  });

  it("responde 409 cuando el teléfono ya está registrado", async () => {
    const phoneNumber = "3001234567";

    const first = await request(app)
      .post("/api/auth/register")
      .send({
        email: email("phone-1"),
        password: PASSWORD,
        phoneNumber,
        inviteCode: await newInvite(),
      });

    const second = await request(app)
      .post("/api/auth/register")
      .send({
        email: email("phone-2"),
        password: PASSWORD,
        phoneNumber,
        inviteCode: await newInvite(),
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("PHONE_TAKEN");
  });

  it("responde 409 ante registros concurrentes con el mismo email", async () => {
    const concurrentEmail = email("race");
    const inviteA = await newInvite();
    const inviteB = await newInvite();

    const responses = await Promise.all([
      request(app)
        .post("/api/auth/register")
        .send({ email: concurrentEmail, password: PASSWORD, inviteCode: inviteA }),
      request(app)
        .post("/api/auth/register")
        .send({ email: concurrentEmail, password: PASSWORD, inviteCode: inviteB }),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("rechaza un código incorrecto", async () => {
    const address = email("otp-malo");
    await registerUser(address, await newInvite());

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: address, code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_OTP");
  });

  it("activa la cuenta con el código correcto", async () => {
    const address = email("otp-ok");
    await registerUser(address, await newInvite());

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: address, code: otpFor(address) });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ACTIVE");

    const user = await prisma.user.findUnique({ where: { email: address } });
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("no permite reutilizar el mismo código", async () => {
    const address = email("otp-reuso");
    await registerUser(address, await newInvite());
    const code = otpFor(address);

    await request(app).post("/api/auth/verify-email").send({ email: address, code });
    const second = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: address, code });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("ALREADY_VERIFIED");
  });
});

describe("POST /api/auth/resend-otp", () => {
  it("no revela si el correo existe", async () => {
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: email("no-existe") });

    expect(res.status).toBe(200);
  });

  it("invalida el código anterior y emite uno nuevo", async () => {
    const address = email("otp-resend");
    await registerUser(address, await newInvite());
    const first = otpFor(address);

    await request(app).post("/api/auth/resend-otp").send({ email: address });
    const second = otpFor(address);

    expect(second).not.toBe(first);

    const withOld = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: address, code: first });
    expect(withOld.status).toBe(400);

    const withNew = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: address, code: second });
    expect(withNew.status).toBe(200);
  });
});

describe("POST /api/auth/login", () => {
  it("rechaza un body inválido sin tumbar el servidor", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "no-es-email", password: "" });

    expect(res.status).toBe(400);

    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
  });

  it("bloquea el login si la cuenta no está verificada", async () => {
    const address = email("sin-verificar");
    await registerUser(address, await newInvite());

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: address, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_VERIFIED");
  });

  it("permite iniciar sesión a una cuenta verificada", async () => {
    const address = email("verificada");
    await registerAndVerify(address);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: address, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
    expect(res.body.user.email).toBe(address);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const address = email("clave-mala");
    await registerAndVerify(address);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: address, password: "WrongPassword1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("rechaza un email no registrado", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: email("nadie"), password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message ?? res.body.error).toBe("Credenciales inválidas");
  });
});

describe("POST /api/admin/invites", () => {
  it("rechaza sin la clave de administración", async () => {
    const res = await request(app).post("/api/admin/invites").send({ count: 1 });

    expect(res.status).toBe(401);
  });

  it("crea invitaciones con la clave correcta", async () => {
    const res = await request(app)
      .post("/api/admin/invites")
      .set("x-admin-key", "test-admin-key-0123456789abcdef0123456789")
      .send({ count: 2, expiresInDays: 3 });

    expect(res.status).toBe(201);
    expect(res.body.invites).toHaveLength(2);
    for (const invite of res.body.invites) {
      createdInvites.push(invite.code);
      expect(invite.code).toMatch(/^[A-Z0-9]{8}$/);
    }
  });
});
