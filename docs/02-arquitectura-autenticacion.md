# 02 · Arquitectura de autenticación e identidad

**Estado:** diseñado, no implementado · **Última revisión:** 2026-11-05
**Depende de:** proveedor de identidad sin definir (ver [03-spike-kyc.md](03-spike-kyc.md)) —
por eso todo el acceso al proveedor pasa por un puerto (`IdentityProvider`).

---

## 1. Principios

1. **El cliente nunca decide el resultado de una verificación.** El backend solo acepta resultados
   firmados por el proveedor, atados a un `challengeId` que él mismo emitió.
2. **La plantilla facial no vive en nuestra base de datos.** Vive en el proveedor; aquí solo hay una
   referencia opaca.
3. **Los tokens se emiten después del rostro, nunca antes.**
4. **Todo intento se audita**, exitoso o no.
5. **Nada de biometría en logs, ni en analítica, ni en trazas de error.**

---

## 2. Flujo de registro (KYC completo)

```
1. POST /api/auth/register
   { email, password, phone }
   → 201 { userId, otpRequired: true }
   → Se crea User en estado PENDING_KYC (L1). NO se emiten tokens de sesión.

2. POST /api/auth/otp/verify
   { userId, code }
   → 200 { emailVerified: true, phoneVerified: true }   (L1 confirmado)

3. POST /api/identity/session
   Authorization: (token de registro de corta vida, emitido en el paso 2)
   → 200 { kycSessionId, providerToken, expiresIn: 900 }
   → El backend crea IdentitySession y pide al proveedor un token de sesión firmado.

4. [App] Captura documento (cédula / PPT / pasaporte) + selfie 3D con prueba de vida.
   El SDK habla directo con el proveedor; nosotros no vemos las imágenes si el proveedor lo permite.

5. POST /api/identity/document
   { kycSessionId, providerResult }
   → Backend valida la firma del resultado y extrae: tipo, país, número (hasheado), nombre,
     fecha de nacimiento, autenticidad.
   → Si edad < 18 → 403 { code: "UNDERAGE" } y la cuenta queda bloqueada (no se borra: se conserva
     evidencia para el caso de un menor que intentó registrarse).
   → 200 { documentVerified: true, ageOver18: true }

6. POST /api/identity/enroll
   { kycSessionId, providerResult }
   → 3D:2D contra la foto del documento + enrolamiento de la plantilla.
   → 1:N contra toda la base.
   → Si hay coincidencia: 409 { code: "IDENTITY_REVIEW" } — mensaje neutro, caso creado para
     revisión humana. NUNCA se revela que la cara existe en otra cuenta.
   → 200 { identityVerified: true, trustLevel: "L2" }

7. POST /api/identity/photos
   { kycSessionId, photoId }
   → Repetir por cada foto de perfil. 3D:2D contra la plantilla.
   → 200 { photoVerified: true }    (L4 cuando están todas)

8. POST /api/auth/login/complete
   { kycSessionId }
   → Aquí, y solo aquí: { accessToken, refreshToken, user }
```

### Reglas del flujo de registro

| Regla | Razón |
|---|---|
| La cuenta existe desde el paso 1 pero **no puede hacer nada** hasta L2 | Evita cuentas fantasma interactuando |
| El `kycSessionId` caduca a los 15 min y es de un solo uso | Evita reutilización de una verificación |
| El resultado del 1:N **nunca** es visible al usuario | Si lo fuera, se convierte en un oráculo de "qué caras están registradas" |
| La imagen del documento **no se guarda** | Solo metadatos + resultado. Se conserva 30 días cifrada si hay disputa |
| Un menor detectado no se borra automáticamente | Evidencia + protección del menor |

---

## 3. Flujo de login (dos fases)

```
POST /api/auth/login
  { email, password, deviceId }
  → 202 { challengeId, faceToken, expiresIn: 300 }
  → Se crea LoginChallenge (single-use, atado a userId + deviceIdHash).
  → NO se emiten tokens de sesión.

[App] Verificación 1:1 contra la plantilla + prueba de vida.

POST /api/auth/face/verify
  { challengeId, providerResult }
  → 200 { accessToken, refreshToken, user, trustLevel }
  → 401 { code: "FACE_MISMATCH", attemptsRemaining: 2 }
  → 429 { code: "LOCKED", retryAfter: 900 }
```

### Reglas del login

| Regla | Valor | Razón |
|---|---|---|
| Caducidad del challenge | 5 min | Ventana corta para completar la captura |
| Usos del challenge | 1 | Anti-replay |
| Intentos faciales por challenge | 3 | Tolerancia a luz/encuadre |
| Bloqueo tras fallos | 3 challenges fallidos → 15 min | Fuerza bruta facial |
| Bloqueo por IP | 10 intentos / 15 min | Ataque distribuido desde un host |
| Dispositivo nuevo | Rostro + confirmación por email | Robo de credenciales desde otro equipo |
| Sesión | Access 15 min · Refresh 30 días deslizante con rotación | "Cada inicio de sesión", no "cada apertura" |

### Ciclo del refresh token (rotación con detección de reuso)

El modelo de datos **ya tiene** `familyId` y `revokedAt` sin usar. Se activan así:

```
login/verify  → crea familia F, token T1 (hash en BD)
refresh(T1)   → emite T2, marca T1 revokedAt = now
refresh(T1) otra vez  ← ¡REUSO!  → revoca TODA la familia F, fuerza re-login con rostro
```

Esto convierte un refresh token robado en un evento detectable: quien lo robó y quien es dueño
legítimo compiten por usarlo, y el segundo uso delata la familia completa.

---

## 4. Matriz de step-up (qué factor exige cada acción)

| Acción | L1 | L2 | L3 | Rostro fresco | PIN | Notas |
|---|---|---|---|---|---|---|
| Ver mazo | ✅ | — | — | — | — | Fotos desenfocadas |
| Ver perfil completo | — | ✅ | — | — | — | |
| Dar like / match | — | ✅ | ✅ | — | — | Requiere sesión biométrica viva |
| Chatear | — | ✅ | ✅ | — | — | |
| Subir foto | ✅ (queda en revisión) | ✅ | — | — | — | Se publica solo con 3D:2D exitoso |
| Cambiar email/teléfono | — | ✅ | ✅ | ✅ (< 5 min) | — | `auth_time` en el token |
| Cambiar contraseña | — | ✅ | ✅ | ✅ | — | |
| Ver sesiones activas | ✅ | ✅ | ✅ | — | — | |
| Cerrar sesión remota | ✅ | ✅ | ✅ | — | — | |
| Borrar cuenta | — | ✅ | ✅ | ✅ | — | Borra plantilla en el proveedor |
| Desbloquear a alguien | — | ✅ | ✅ | ✅ | — | |
| Iniciar cita segura | — | ✅ | ✅ | ✅ | ✅ | Doble confirmación |

"Rostro fresco" se implementa con el claim `auth_time` del access token: si es más viejo que 300 s,
el backend responde `401 { code: "STEP_UP_REQUIRED" }` y el cliente dispara la captura.

---

## 5. Diseño de tokens

```jsonc
// Access token (15 min, HS256 → evaluar RS256 cuando haya más de un servicio)
{
  "sub": "usr_...",
  "role": "USER",
  "trust": "L4",
  "amr": ["pwd", "face"],        // con qué se autenticó
  "acr": "loa-2",                // nivel de garantía
  "auth_time": 1762272000,       // para step-up fresco
  "did": "sha256(deviceId)",     // dispositivo
  "jti": "...",
  "iss": "dateapp-api",
  "aud": "dateapp-app"
}
```

| Claim | Para qué |
|---|---|
| `amr` | Saber si la sesión pasó por rostro; sin `face` no se permite chatear |
| `acr` | Nivel de garantía de autenticación (futuro: exigir acr mayor en acciones críticas) |
| `auth_time` | Step-up por frescura |
| `did` | Detectar uso del token desde otro dispositivo |
| `trust` | Evitar consultar la BD en cada request para el nivel |

**Refresh token:** JWT opaco para el cliente, 7 días en el JWT pero 30 días deslizante en BD
(se renueva en cada rotación). El hash SHA-256 va a `RefreshToken.tokenHash`; el token real nunca
se persiste.

---

## 6. Contrato de API

Base: `/api`. Todas las respuestas de error comparten la forma:

```json
{ "error": "mensaje para el usuario", "code": "CODIGO_ESTABLE", "details": {} }
```

Los `code` son estables y en inglés; los `error` son en español y traducibles después.

### Autenticación

| Método | Ruta | Body | Éxito | Errores propios |
|---|---|---|---|---|
| POST | `/auth/register` | `email, password, phone` | 201 `{userId}` | 409 `EMAIL_TAKEN`, 400 `VALIDATION` |
| POST | `/auth/otp/verify` | `userId, code` | 200 | 400 `INVALID_OTP`, 429 `OTP_ATTEMPTS` |
| POST | `/auth/login` | `email, password, deviceId` | 202 `{challengeId, faceToken}` | 401 `INVALID_CREDENTIALS`, 403 `NOT_VERIFIED`, 429 `LOCKED` |
| POST | `/auth/face/verify` | `challengeId, providerResult` | 200 `{tokens,user}` | 401 `FACE_MISMATCH`, 410 `CHALLENGE_EXPIRED` |
| POST | `/auth/refresh` | `refreshToken, deviceId` | 200 `{tokens}` | 401 `REFRESH_REUSED`, 401 `REFRESH_EXPIRED` |
| POST | `/auth/logout` | `refreshToken` | 204 | — |
| GET | `/auth/me` | — | 200 `{user, trustLevel, badges}` | 401 |
| DELETE | `/auth/sessions/:id` | — | 204 | 404 |

### Identidad

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/identity/session` | Abre sesión KYC con el proveedor |
| POST | `/identity/document` | Valida documento + edad |
| POST | `/identity/enroll` | Enrola plantilla + 1:N |
| POST | `/identity/photos` | Coteja una foto de perfil (3D:2D) |
| GET | `/identity/status` | Estado del KYC en curso |
| POST | `/identity/reverify` | Re-verificación periódica (fotos, documento vencido) |
| DELETE | `/identity/template` | Borra la plantilla (borrado de cuenta) |

### Seguridad de usuario (ver doc 04)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/safety/contacts` · POST · DELETE | Contactos de confianza |
| POST | `/safety/session` | Inicia cita segura |
| POST | `/safety/session/:id/checkin` | Check-in "estoy bien" |
| POST | `/safety/session/:id/panic` | Pánico |
| GET | `/safety/session/:id/public/:token` | Vista pública para el contacto (sin login) |

---

## 7. Modelo de datos (Prisma)

Esquema objetivo. El actual (`User` + `RefreshToken`) es un subconjunto de esto.

```prisma
enum TrustLevel  { L0 L1 L2 L3 L4 L5 }
enum UserStatus  { PENDING_KYC ACTIVE SUSPENDED DELETED }
enum DocType     { CC CE PPT PASSPORT }
enum Verdict     { PASS FAIL REVIEW }

model User {
  id              String     @id @default(uuid())
  email           String     @unique
  phone           String?    @unique
  passwordHash    String
  role            Role       @default(USER)
  trustLevel      TrustLevel @default(L1)
  status          UserStatus @default(PENDING_KYC)
  emailVerifiedAt DateTime?
  phoneVerifiedAt DateTime?
  birthDate       DateTime?          // del documento, no autodeclarada
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  profile         Profile?
  documents       Document[]
  enrollment      FaceEnrollment?
  devices         Device[]
  refreshTokens   RefreshToken[]
  sessions        IdentitySession[]
}

model Profile {
  userId       String  @id
  displayName  String
  bio          String?
  gender       String?
  orientation  String?
  city         String?
  locationCell String?          // geohash truncado — NUNCA lat/lng
  lastActiveAt DateTime?
}

model Photo {
  id         String    @id @default(uuid())
  userId     String
  storageKey String
  faceMatch  Verdict   @default(REVIEW)
  matchScore Float?
  verifiedAt DateTime?
  isPrimary  Boolean   @default(false)
  sortOrder  Int       @default(0)
  deletedAt  DateTime?
  @@index([userId])
}

model Document {
  id            String    @id @default(uuid())
  userId        String
  type          DocType
  country       String    @default("CO")
  numberHash    String              // hash con pepper; nunca el número en claro
  fullName      String?
  birthDate     DateTime?
  authenticity  Verdict
  ocrConfidence Float?
  verifiedAt    DateTime?
  purgeAt       DateTime?           // imagen se destruye en esta fecha
  @@index([userId])
}

model FaceEnrollment {
  id            String    @id @default(uuid())
  userId        String    @unique
  provider      String
  providerRef   String    @unique      // opaco
  templateVersion Int     @default(1)
  enrolledAt    DateTime  @default(now())
  lastMatchedAt DateTime?
  revokedAt     DateTime?
}

model Device {
  id           String   @id @default(uuid())
  userId       String
  deviceIdHash String   @unique
  platform     String
  model        String?
  attestedAt   DateTime?
  trusted      Boolean  @default(false)
  firstSeenAt  DateTime @default(now())
  lastSeenAt   DateTime @updatedAt
  revokedAt    DateTime?
  @@index([userId])
}

model IdentitySession {
  id          String   @id @default(uuid())
  userId      String
  provider    String
  providerRef String?
  state       String   // CREATED | DOC_OK | ENROLLED | DONE | EXPIRED | REVIEW
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}

model LoginChallenge {
  id           String    @id @default(uuid())
  userId       String
  deviceIdHash String
  nonce        String    @unique
  faceToken    String?
  attempts     Int       @default(0)
  expiresAt    DateTime
  consumedAt   DateTime?
  @@index([userId])
}

model VerificationEvent {          // append-only
  id           String   @id @default(uuid())
  userId       String?
  type         String   // ENROLL | LOGIN | PHOTO | DOC | STEP_UP
  result       Verdict
  livenessScore Float?
  matchScore   Float?
  deviceIdHash String?
  ipHash       String?
  createdAt    DateTime @default(now())
  @@index([userId, createdAt])
}

model LoginAttempt {
  id        String   @id @default(uuid())
  email     String
  userId    String?
  result    String   // OK | BAD_PASSWORD | FACE_FAIL | LOCKED | RATE_LIMITED
  ipHash    String?
  createdAt DateTime @default(now())
  @@index([email, createdAt])
}

model TrustedContact {
  id         String    @id @default(uuid())
  userId     String
  name       String
  phone      String
  email      String?
  verifiedAt DateTime?
}

model SafetySession {
  id         String    @id @default(uuid())
  userId     String
  matchId    String?
  state      String    // ACTIVE | CHECKIN_DUE | ALERTED | ENDED | PANIC
  startsAt   DateTime  @default(now())
  endsAt     DateTime?
  nextCheckIn DateTime?
  shareToken String    @unique
  @@index([userId])
}

model SafetyPing {
  sessionId String
  lat       Float      // cifrado en reposo; solo visible vía shareToken
  lng       Float
  accuracy  Float?
  createdAt DateTime   @default(now())
  purgeAt   DateTime              // TTL 24 h
  @@index([sessionId, createdAt])
}

model ScreenshotEvent {
  id             String   @id @default(uuid())
  userId         String
  conversationId String?
  platform       String
  detectedAt     DateTime @default(now())
}
```

### Retención (se implementa como job programado)

| Dato | Vida | Acción |
|---|---|---|
| Imagen del documento | 30 días | Borrado del almacenamiento |
| Imagen de selfie / FaceMap | En el proveedor, mientras la cuenta exista | Borrado al eliminar cuenta (API del proveedor) |
| `VerificationEvent` | 2 años | Archivar, luego purgar |
| `SafetyPing` | 24 h | Purga por TTL |
| `LoginAttempt` | 12 meses | Purga |
| `Photo` (archivo) | Mientras el perfil exista | Borrado 30 días tras delete |

---

## 8. El puerto `IdentityProvider`

```ts
// src/identity/IdentityProvider.ts

export type DocType = "CC" | "CE" | "PPT" | "PASSPORT";

export interface KycSession {
  sessionId: string;
  providerToken: string;   // lo consume el SDK en el móvil
  expiresIn: number;
}

export interface DocumentResult {
  verdict: "PASS" | "FAIL" | "REVIEW";
  docType: DocType;
  country: string;
  numberHash: string;
  fullName?: string;
  birthDate?: Date;
  confidence: number;
  raw: unknown;            // firmado por el proveedor; se valida antes de usar
}

export interface FaceResult {
  verdict: "PASS" | "FAIL" | "REVIEW";
  liveness: number;
  matchScore: number;
  providerRef?: string;    // plantilla / referencia
  raw: unknown;
}

export interface SearchResult {
  found: boolean;
  candidateCount: number;  // sin identificadores: el backend no debe saber "quién"
  score?: number;
}

export interface IdentityProvider {
  readonly name: string;
  createSession(userId: string, deviceIdHash: string): Promise<KycSession>;
  scanDocument(sessionId: string, payload: unknown): Promise<DocumentResult>;
  enrollFace(sessionId: string, payload: unknown): Promise<FaceResult>;
  search1toN(sessionId: string): Promise<SearchResult>;
  verifyFace1to1(userId: string, payload: unknown): Promise<FaceResult>;
  matchPhotoToFace(userId: string, photo: Buffer): Promise<FaceResult>;
  deleteTemplate(userId: string): Promise<void>;
}
```

**Regla:** ninguna ruta importa un SDK de proveedor. Solo importa el puerto. El adaptador concreto
se inyecta por variable de entorno. Eso permite cambiar de proveedor (o correr el mock en tests)
sin tocar el flujo de auth.

---

## 9. Brecha con el código actual

| Pieza | Hoy | Falta |
|---|---|---|
| Registro/login | ✅ funciona con argon2 + JWT | Reestructurar a dos fases |
| Refresh | ❌ no existe | Endpoint + rotación + detección de reuso |
| Logout | ❌ no existe | Endpoint + revocación de familia |
| `requireAuth` | ❌ no existe | Middleware con `amr`/`auth_time`/`did` |
| `/me` | ❌ no existe | Endpoint |
| Identidad | ❌ nada | Todo el módulo |
| Auditoría | ❌ nada | `VerificationEvent`, `LoginAttempt` |
| Rate limit | Global 100/15 min | Por ruta + por cuenta |
| Tests | 12 de auth | + refresh, reuso, step-up, mock de identidad |

Ver [06-roadmap.md](06-roadmap.md) para el orden.
