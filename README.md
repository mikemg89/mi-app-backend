# mi-app-backend

API de DateApp — registro cerrado por invitación + verificación de email.

> **Documentación del proyecto:** [`docs/`](docs/README.md)
> La guía de trabajo actual es [`docs/00-mvp-sin-presupuesto.md`](docs/00-mvp-sin-presupuesto.md).
> Este README solo cubre cómo correr el backend.

---

## Stack

| | |
|---|---|
| Runtime | Node.js 20.19+ / 22.12+ / 24+ |
| Framework | Express 4 + TypeScript (CommonJS) |
| ORM | Prisma 7 con driver adapter `@prisma/adapter-pg` |
| Base de datos | PostgreSQL |
| Hash de contraseñas | Argon2id (64 MB, 3 iteraciones) |
| Validación | Zod 4 |
| Tests | Vitest + Supertest (+ smoke sin bundler) |

---

## Puesta en marcha

```bash
npm install
cp .env.example .env      # completar DATABASE_URL, los dos secretos JWT y ADMIN_API_KEY
npm run db:migrate        # crea/actualiza el esquema
npm run dev               # http://localhost:3000
```

### Variables

| Variable | Obligatoria | Nota |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL |
| `JWT_ACCESS_SECRET` | ✅ | Mínimo 32 caracteres — `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | ✅ | Distinto del anterior |
| `ADMIN_API_KEY` | recomendada | Si falta, `/api/admin/*` responde 503 |
| `MAIL_DRIVER` | — | `console` (por defecto, imprime el correo en la terminal) o `memory` (tests) |
| `PORT` | — | 3000 |
| `NODE_ENV` | — | `development` \| `test` \| `production` |
| `CORS_ORIGINS` | — | Por coma. Si se omite, se permite cualquier origen |
| `TRUST_PROXY` | — | **Obligatorio en producción tras un proxy**, si no el rate limit ve una sola IP |

Con `MAIL_DRIVER=console` no hace falta ningún proveedor de correo: el OTP sale por la terminal.

---

## Flujo de registro (implementado)

```
POST /api/auth/register      { email, password, inviteCode, phoneNumber? }
                             → 201 PENDING_VERIFICATION + OTP al correo
POST /api/auth/verify-email  { email, code }        → 200 ACTIVE
POST /api/auth/resend-otp    { email }              → 200 (siempre genérico)
POST /api/auth/login         { email, password }    → 200 tokens (solo si ACTIVE)

POST /api/admin/invites      header: x-admin-key    → 201 { invites: [{ code, expiresAt }] }
GET  /api/admin/invites/stats header: x-admin-key   → { available, used }
```

### Verificación por video-selfie (paso 2)

```
POST /api/verification/challenge   auth    → 201 { verificationId, code, expiresAt }
POST /api/verification/video       auth    → 202 PENDING_REVIEW
     header: x-verification-id, Content-Type: video/mp4
     body: el archivo binario (máx. 15 MB)
GET  /api/verification/status      auth    → { videoStatus, verification }
POST /api/verification/review      x-admin-key
     { verificationId, decision: "APPROVED" | "REJECTED" }
```

El código de 6 dígitos lo emite el servidor y el usuario debe decirlo en el video: así una
grabación pregrabada no sirve. Con `TELEGRAM_BOT_TOKEN` y `TELEGRAM_ADMIN_CHAT_ID` configurados,
el video llega al bot con botones **Aprobar / Rechazar**; sin ellos queda `PENDING_REVIEW` y se
resuelve con `/api/verification/review`. El archivo se borra en cuanto se revisa.

Errores con `code` estable: `VALIDATION`, `INVALID_INVITE`, `EMAIL_TAKEN`, `PHONE_TAKEN`,
`INVALID_OTP`, `OTP_EXPIRED`, `OTP_LOCKED`, `ALREADY_VERIFIED`, `NOT_VERIFIED`,
`CHALLENGE_EXPIRED`, `VERIFICATION_STATE`, `UNSUPPORTED_MEDIA`.

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga (`tsx watch`) |
| `npm run build` | Compila a `dist/` |
| `npm start` | Ejecuta `dist/server.js` (requiere build) |
| `npm test` | Vitest (necesita PostgreSQL real) |
| `npm run smoke` | Compila y corre 23 comprobaciones (registro + video) con `node` puro |
| `npm run invite` | Crea un código de invitación en la base de datos |
| `npm run telegram:setup -- <token>` | Valida el bot, descubre tu chat id y escribe el `.env` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + `prisma validate` |
| `npm run db:migrate` / `db:deploy` | Migraciones en dev / producción |
| `npm run db:studio` | Prisma Studio |

**Cuándo usar `smoke`:** si `npm test` no arranca (entornos sin permiso de `spawn`, contenedores
restringidos), `npm run smoke` valida el flujo completo sin Vite ni esbuild.

---

## Estructura

```
src/
├── app.ts                  # middlewares, rutas, manejo de errores
├── server.ts               # arranque + apagado ordenado
├── config/env.ts           # validación de entorno con Zod
├── controllers/            # auth (register/verify/login), admin (invitaciones)
├── routes/
├── services/               # mailer, otp, invites
├── utils/                  # jwt, password, validadores, ApiError, asyncHandler
├── lib/prisma.ts
└── generated/prisma/       # cliente generado (gitignored)
prisma/
├── schema.prisma           # User, RefreshToken, Invite, EmailOtp
└── migrations/
tests/                      # integración
scripts/smoke.cjs           # verificación sin bundler
```

---

## Estado

Implementado:

- Registro cerrado por invitación de un solo uso (transaccional: no deja usuarios huérfanos).
- OTP de 6 dígitos hasheado con HMAC, 10 min de vida, máximo 5 intentos, un solo código vigente.
- Login bloqueado hasta verificar el correo (`403 NOT_VERIFIED`).
- Argon2id, JWT, rate limit por IP (global + específico de auth), helmet, apagado ordenado.
- 14 comprobaciones de humo + suite de Vitest.

Pendiente (siguiente paso del MVP):

1. Video-selfie con código aleatorio + bot de revisión (`videoStatus` ya está en el esquema).
2. Refresh con rotación y detección de reuso (`familyId` y `revokedAt` ya existen, sin usar).
3. `POST /api/auth/logout` y `GET /api/auth/me`.
4. Dominio: perfil, fotos, mazo, match.

---

## Notas

- `dist/` puede contener compilados viejos: `npm start` sin `npm run build` ejecuta código
  desactualizado.
- Los tests **borran usuarios de la base configurada en `DATABASE_URL`** (solo los de prefijo de
  prueba), pero nunca apuntes esa variable a producción.
- El cliente de Prisma se regenera en `predev`, `prebuild` y `pretest`.
- Si `prisma migrate dev` reporta un checksum distinto en `20261105223000_invite_and_email_otp`,
  usa `npx prisma migrate resolve --applied 20261105223000_invite_and_email_otp`.
