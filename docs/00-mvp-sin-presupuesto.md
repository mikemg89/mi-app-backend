# 00 · MVP sin presupuesto

**Versión realista para una persona, sin gastar dinero.** Sustituye como guía de trabajo a los
documentos 01–06, que quedan como visión de largo plazo.

**Fecha:** 2026-11-05

---

## 1. La idea

A 50–200 usuarios no necesitas verificación biométrica automática: necesitas que **una persona
real haya sido vista en video** y que **cada perfil lo haya aprobado un humano** (tú).

La prueba de vida gratuita y difícil de engañar es simple: el usuario graba **5 segundos diciendo
un código aleatorio** que aparece en pantalla. Una foto robada no lo pasa; un video pregrabado
tampoco, porque el código cambia cada vez.

> **Regla del MVP:** nadie aparece en el mazo sin que un humano haya visto su video.

---

## 2. Flujo de alta

```
1. Alguien con cuenta te pide un código de invitación (o lo generas tú).
2. POST /auth/register  →  email + contraseña + código de invitación
3. Llega un OTP de 6 dígitos al email.
4. POST /auth/verify-email  →  cuenta ACTIVE
5. La app graba el video-selfie con el código en pantalla y lo sube.
6. Tú lo revisas (bot de Telegram) y apruebas o rechazas.
7. Aprobado → puede subir fotos y aparecer en el mazo.
```

Sin invitación no hay registro. Sin video aprobado no hay perfil. Eso es todo el sistema de
verificación del MVP.

---

## 3. Modelo de datos (lo mínimo)

```prisma
model User {
  id              String     @id @default(uuid())
  email           String     @unique
  passwordHash    String
  status          UserStatus @default(PENDING_VERIFICATION)
  emailVerifiedAt DateTime?
  videoStatus     VideoStatus @default(NONE)   // NONE | PENDING | APPROVED | REJECTED
  createdAt       DateTime   @default(now())
}

model Invite {
  id        String    @id @default(uuid())
  code      String    @unique
  createdBy String?
  usedBy    String?   @unique
  usedAt    DateTime?
  expiresAt DateTime
}

model EmailOtp {
  id         String    @id @default(uuid())
  userId     String
  codeHash   String
  expiresAt  DateTime
  consumedAt DateTime?
  attempts   Int       @default(0)
}
```

`videoStatus` es el semáforo del perfil. Todo lo demás (fotos, matches, chat) se apoya en él.

---

## 4. Endpoints del MVP

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/admin/invites` | Genera códigos (cabecera `x-admin-key`) |
| POST | `/auth/register` | Valida invitación, crea cuenta `PENDING_VERIFICATION`, envía OTP |
| POST | `/auth/verify-email` | Consume el OTP → `ACTIVE` |
| POST | `/auth/resend-otp` | Reenvía el código (invalida el anterior) |
| POST | `/auth/login` | Solo si `status = ACTIVE` |
| POST | `/verification/video` | Recibe el video, lo deja `PENDING` *(paso 2)* |
| POST | `/verification/review` | Aprueba/rechaza *(paso 2)* |

---

## 5. Lo que NO se construye

| No | Por qué |
|---|---|
| Verificación de documento (cédula/PPT) | Cuesta dinero y obliga a DPA con la SIC |
| Búsqueda 1:N | Crea una base biométrica: la obligación legal más cara del proyecto |
| Login facial | Complejidad alta, beneficio nulo a esta escala |
| Atestación de dispositivo | Semanas de trabajo para un riesgo que todavía no existe |
| Reconocimiento facial automático | A 200 usuarios, mirar el video tarda 30 segundos |

---

## 6. Costos

| Concepto | Costo |
|---|---|
| Backend + Postgres | $0 (Render/Fly free + Neon/Supabase free) |
| Email (OTP) | $0 (Resend 3.000/mes o Brevo 300/día) |
| Almacenamiento de video | $0 (disco del servidor, borrado a 7 días) |
| Revisión | Tu tiempo: ~30 s por alta |
| Publicar en Play Store | $25 una vez (solo al publicar) |
| App Store | $99/año — **omitir por ahora** |

---

## 7. Plan de 3 semanas

| Semana | Entregable | Criterio |
|---|---|---|
| **1** | Invitación + OTP por email | No se puede registrar sin invitar; la cuenta queda `PENDING_VERIFICATION` |
| **2** | Video-selfie + bot de revisión | Ningún perfil pasa a `APPROVED` sin revisión humana |
| **3** | Perfil mínimo + mazo | Solo se ven perfiles `APPROVED` |

**Cada semana termina en algo que se puede mostrar.** Si una semana se desborda, se recorta el
alcance, no la seguridad.

---

## 8. Qué se mide

| Métrica | Objetivo |
|---|---|
| Altas aprobadas / altas iniciadas | ≥ 60 % |
| Tiempo de revisión | < 24 h |
| Perfiles falsos detectados | Cualquiera es señal de que la revisión funciona |
| Reportes de catfishing | 0 en beta cerrada |

---

## 9. Cuándo se sube de nivel

Cuando pase **cualquiera** de estos umbrales, se reabre el documento 03 (proveedor pagado):

- 300–500 usuarios registrados.
- La revisión manual pase de 30 minutos diarios.
- Aparezca evasión de bans (misma persona, otra cuenta).
- La app genere ingresos que paguen ~USD 1 por verificación.

Hasta entonces, el sistema de este documento es **más seguro que un KYC mal integrado**, porque un
humano mira cada caso y no hay una base biométrica que filtrar.

---

## 10. Qué queda igual del diseño original

- Tokens: access corto + refresh con rotación.
- Argon2id, rate limiting, helmet.
- Bloqueo tras intentos fallidos.
- Ubicación difusa (geohash, sin coordenadas).
- Bloqueo y reportes.
- Insignia honesta: **"Video verificado · fecha"**, nunca "identidad verificada" ni "100 % seguro".
