// Smoke test del flujo de registro cerrado (paso 1), sobre el build compilado.
// Se ejecuta con `node`, sin bundlers ni workers: el sandbox bloquea los spawn.
process.env.NODE_ENV = "test";
process.env.MAIL_DRIVER = "memory";
process.env.ADMIN_API_KEY = "test-admin-key-0123456789abcdef0123456789";

const request = require("supertest");
const app = require("../dist/app").default;
const { prisma } = require("../dist/lib/prisma");
const { memoryMailbox } = require("../dist/services/mailer");
const { generateInviteCode } = require("../dist/services/invites");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    results.push(`  ok   ${name}`);
  } else {
    failures += 1;
    results.push(`  FAIL ${name}${detail ? ` → ${detail}` : ""}`);
  }
}

(async () => {
  const tag = `${Date.now()}`;
  const email = (s) => `smoke-${tag}.${s}@example.com`;
  const PASSWORD = "Password1";
  const invites = [];

  const mkInvite = async () => {
    const code = generateInviteCode();
    invites.push(code);
    await prisma.invite.create({
      data: { code, expiresAt: new Date(Date.now() + 86400000) },
    });
    return code;
  };

  const otpFor = (address) => {
    const msg = memoryMailbox.lastTo(address);
    const m = msg ? /(\d{6})/.exec(msg.text) : null;
    return m ? m[1] : "";
  };

  const noInvite = await request(app)
    .post("/api/auth/register")
    .send({ email: email("a"), password: PASSWORD });
  check("registro sin invitación → 400", noInvite.status === 400, `status=${noInvite.status}`);

  const badInvite = await request(app)
    .post("/api/auth/register")
    .send({ email: email("b"), password: PASSWORD, inviteCode: "NOEXISTE" });
  check(
    "invitación falsa → 400 INVALID_INVITE",
    badInvite.status === 400 && badInvite.body.code === "INVALID_INVITE",
    JSON.stringify(badInvite.body),
  );

  const invite = await mkInvite();
  const address = email("ok");
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email: address, password: PASSWORD, inviteCode: invite });
  check(
    "registro válido → 201 PENDING_VERIFICATION",
    reg.status === 201 && reg.body.status === "PENDING_VERIFICATION",
    JSON.stringify(reg.body),
  );

  const reuse = await request(app)
    .post("/api/auth/register")
    .send({ email: email("c"), password: PASSWORD, inviteCode: invite });
  check("invitación usada → 400", reuse.status === 400, `status=${reuse.status}`);

  const orphan = await prisma.user.findUnique({ where: { email: email("c") } });
  check("no queda usuario huérfano", orphan === null);

  const early = await request(app)
    .post("/api/auth/login")
    .send({ email: address, password: PASSWORD });
  check(
    "login sin verificar → 403 NOT_VERIFIED",
    early.status === 403 && early.body.code === "NOT_VERIFIED",
    JSON.stringify(early.body),
  );

  const wrong = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: address, code: "000000" });
  check("OTP incorrecto → 400", wrong.status === 400, `status=${wrong.status}`);

  const code = otpFor(address);
  check("se envió el OTP por correo", /^\d{6}$/.test(code), `code=${code}`);

  const verified = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: address, code });
  check(
    "OTP correcto → 200 ACTIVE",
    verified.status === 200 && verified.body.status === "ACTIVE",
    JSON.stringify(verified.body),
  );

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: address, password: PASSWORD });
  check(
    "login verificado → 200 con tokens",
    login.status === 200 &&
      typeof login.body.accessToken === "string" &&
      typeof login.body.refreshToken === "string",
    JSON.stringify(login.body).slice(0, 120),
  );

  const resend = await request(app)
    .post("/api/auth/resend-otp")
    .send({ email: address });
  check("reenvío a cuenta activa → 200 genérico", resend.status === 200);

  const oldAgain = await request(app)
    .post("/api/auth/verify-email")
    .send({ email: address, code });
  check("código ya consumido → 409 ALREADY_VERIFIED", oldAgain.status === 409, `status=${oldAgain.status}`);

  const noKey = await request(app).post("/api/admin/invites").send({ count: 1 });
  check("admin sin clave → 401", noKey.status === 401, `status=${noKey.status}`);

  const withKey = await request(app)
    .post("/api/admin/invites")
    .set("x-admin-key", process.env.ADMIN_API_KEY)
    .send({ count: 2, expiresInDays: 3 });
  check(
    "admin con clave → 201 y 2 códigos",
    withKey.status === 201 && Array.isArray(withKey.body.invites) && withKey.body.invites.length === 2,
    JSON.stringify(withKey.body).slice(0, 160),
  );
  for (const i of withKey.body.invites || []) invites.push(i.code);

  // ── Paso 2: verificación por video-selfie ──────────────────────────────
  const loginForVideo = await request(app)
    .post("/api/auth/login")
    .send({ email: address, password: PASSWORD });
  const token = loginForVideo.body.accessToken;

  const noAuth = await request(app)
    .post("/api/verification/challenge")
    .send({});
  check("challenge sin token → 401", noAuth.status === 401, `status=${noAuth.status}`);

  const challenge = await request(app)
    .post("/api/verification/challenge")
    .set("Authorization", `Bearer ${token}`)
    .send({});
  check(
    "challenge con token → 201 y código de 6 dígitos",
    challenge.status === 201 && /^\d{6}$/.test(String(challenge.body.code ?? "")),
    JSON.stringify(challenge.body).slice(0, 160),
  );

  const fakeMp4 = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypisom", "ascii"),
    Buffer.alloc(2048, 0),
  ]);

  const notVideo = await request(app)
    .post("/api/verification/video")
    .set("Authorization", `Bearer ${token}`)
    .set("x-verification-id", challenge.body.verificationId)
    .set("Content-Type", "video/mp4")
    .send(Buffer.from("esto no es un video"));

  check("archivo que no es video → 415", notVideo.status === 415, `status=${notVideo.status}`);

  const upload = await request(app)
    .post("/api/verification/video")
    .set("Authorization", `Bearer ${token}`)
    .set("x-verification-id", challenge.body.verificationId)
    .set("Content-Type", "video/mp4")
    .send(fakeMp4);

  check(
    "video válido → 202 PENDING_REVIEW",
    upload.status === 202 && upload.body.status === "PENDING_REVIEW",
    JSON.stringify(upload.body).slice(0, 160),
  );

  const pending = await request(app)
    .get("/api/verification/status")
    .set("Authorization", `Bearer ${token}`);
  check(
    "estado tras subir → PENDING",
    pending.status === 200 && pending.body.videoStatus === "PENDING",
    JSON.stringify(pending.body).slice(0, 160),
  );

  const reviewNoKey = await request(app)
    .post("/api/verification/review")
    .send({ verificationId: challenge.body.verificationId, decision: "APPROVED" });
  check("review sin clave → 401", reviewNoKey.status === 401, `status=${reviewNoKey.status}`);

  const review = await request(app)
    .post("/api/verification/review")
    .set("x-admin-key", process.env.ADMIN_API_KEY)
    .send({ verificationId: challenge.body.verificationId, decision: "APPROVED" });
  check(
    "review con clave → 200 APPROVED",
    review.status === 200 && review.body.status === "APPROVED",
    JSON.stringify(review.body).slice(0, 160),
  );

  const after = await request(app)
    .get("/api/verification/status")
    .set("Authorization", `Bearer ${token}`);
  check(
    "estado tras aprobar → APPROVED",
    after.status === 200 && after.body.videoStatus === "APPROVED",
    JSON.stringify(after.body).slice(0, 160),
  );

  const reviewedTwice = await request(app)
    .post("/api/verification/review")
    .set("x-admin-key", process.env.ADMIN_API_KEY)
    .send({ verificationId: challenge.body.verificationId, decision: "REJECTED" });
  check("revisar dos veces → 409", reviewedTwice.status === 409, `status=${reviewedTwice.status}`);

  await prisma.user.deleteMany({ where: { email: { startsWith: `smoke-${tag}.` } } });
  await prisma.invite.deleteMany({ where: { code: { in: invites } } });
  await prisma.$disconnect();

  console.log(results.join("\n"));
  console.log(`\n${results.length - failures}/${results.length} comprobaciones OK`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
