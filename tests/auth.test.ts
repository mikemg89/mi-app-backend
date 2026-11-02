import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emailPrefix = `test-auth-${runId}`;
const email = (suffix: string) => `${emailPrefix}.${suffix}@example.com`;
const PASSWORD = "Password1";

afterAll(async () => {
  // Limpia únicamente los usuarios creados por esta ejecución.
  await prisma.user.deleteMany({
    where: { email: { startsWith: emailPrefix } },
  });
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("rechaza un email inválido sin tumbar el servidor", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "no-es-email", password: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email inválido");

    // El proceso sigue vivo y puede atender otra petición.
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
  });

  it("rechaza una contraseña débil", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: email("weak-password"), password: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "La contraseña debe tener al menos 8 caracteres",
    );
  });

  it("registra un usuario válido y normaliza el email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: `${emailPrefix}.Case@Example.COM`, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Usuario registrado exitosamente");
    expect(res.body.userId).toBeTypeOf("string");
  });

  it("rechaza un email duplicado sin importar mayúsculas", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: `${emailPrefix}.CASE@EXAMPLE.COM`, password: PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("El email ya está registrado");
  });

  it("trata el teléfono vacío como ausente", async () => {
    const first = await request(app)
      .post("/api/auth/register")
      .send({ email: email("empty-phone-1"), password: PASSWORD, phoneNumber: "" });

    const second = await request(app)
      .post("/api/auth/register")
      .send({
        email: email("empty-phone-2"),
        password: PASSWORD,
        phoneNumber: "   ",
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("rechaza un teléfono con formato inválido", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: email("invalid-phone"),
        password: PASSWORD,
        phoneNumber: "abc",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "El teléfono debe tener entre 7 y 15 dígitos",
    );
  });

  it("responde 409 cuando el teléfono ya está registrado", async () => {
    const phoneNumber = "3001234567";

    const first = await request(app)
      .post("/api/auth/register")
      .send({ email: email("phone-1"), password: PASSWORD, phoneNumber });

    const second = await request(app)
      .post("/api/auth/register")
      .send({ email: email("phone-2"), password: PASSWORD, phoneNumber });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("El teléfono ya está registrado");
  });

  it("responde 409 ante registros concurrentes con el mismo email", async () => {
    const concurrentEmail = email("race");

    const responses = await Promise.all([
      request(app)
        .post("/api/auth/register")
        .send({ email: concurrentEmail, password: PASSWORD }),
      request(app)
        .post("/api/auth/register")
        .send({ email: concurrentEmail, password: PASSWORD }),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
  });
});

describe("POST /api/auth/login", () => {
  it("rechaza un body inválido sin tumbar el servidor", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "no-es-email", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");

    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
  });

  it("permite iniciar sesión sin distinguir mayúsculas en el email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `${emailPrefix}.case@example.com`, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
    expect(res.body.user.email).toBe(`${emailPrefix}.case@example.com`);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: email("case"), password: "WrongPassword1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("rechaza un email no registrado", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: email("nobody"), password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });
});
