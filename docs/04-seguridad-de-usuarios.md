# 04 · Seguridad de los usuarios

**Estado:** especificado · **Última revisión:** 2026-11-05

El login facial protege la **cuenta**. Este documento protege a la **persona**. Son problemas
distintos y el segundo es el que genera titulares.

---

## 1. Anti-catfishing: el hueco que casi todas las apps tienen

El error clásico:

> Verificas una vez en el registro y después subes fotos de otra persona.

La verificación de identidad no sirve de nada si las fotos del perfil no están atadas a esa
identidad. Por eso:

### Regla no negociable

**Ninguna foto se publica sin pasar el cotejo 3D:2D contra la plantilla enrolada. En cada subida,
no una sola vez.**

```
POST /api/profile/photos            (multipart)
  → sube a almacenamiento temporal
  → provider.matchPhotoToFace(userId, buffer)
  → PASS    → se publica, Photo.faceMatch = PASS
  → FAIL    → 422 { code: "PHOTO_NOT_YOU" }  (mensaje neutro)
  → REVIEW  → queda oculta, caso para revisión humana
```

### Mensajes al usuario (importante)

| Caso | Texto | NUNCA |
|---|---|---|
| Foto no coincide | "No pudimos validar esta foto. Usa una foto tuya, reciente y con buena luz." | "Esta foto no es tuya" |
| Falla reiterada | "Verifica de nuevo tu identidad para continuar." | "Estás intentando subir fotos falsas" |

Acusar directamente produce dos problemas: enfada a los falsos positivos (que son mayoría) y le
enseña al atacante exactamente qué ajustar.

### Re-verificación

| Disparador | Acción |
|---|---|
| 6 meses desde la última verificación de fotos | Baja a L3; no aparece en el mazo hasta re-verificar |
| Cambio de foto principal | Cotejo obligatorio de la nueva |
| 3 reportes de "las fotos no coinciden" | Revisión manual + re-verificación forzada |
| Cambio de dispositivo | No afecta fotos, sí sesión |

### Detección de fotos que no son de la persona

Además del 3D:2D, señales que elevan a revisión manual (nunca bloqueo automático):

- Metadatos EXIF ausentes o manipulados en todas las fotos.
- Imagen con marca de agua de banco de imágenes o de red social.
- Foto idéntica (perceptual hash) a la de otro perfil ya reportado.
- Salto brusco de calidad/estilo entre fotos publicadas.
- Fotos con más de 5 años por metadatos, en un perfil que dice tener 25.

---

## 2. Ubicación difusa

La ubicación exacta es el vector de **stalking** más común en apps de citas. La regla:

> **La API nunca devuelve coordenadas. Ni propias ni ajenas.**

### Especificación

| Aspecto | Decisión |
|---|---|
| Almacenamiento | **Geohash truncado a 5 caracteres** (~4,9 km × 4,9 km) + ciudad |
| Precisión máxima guardada | Celda de ~5 km. No se guarda lat/lng exacta en ningún lado |
| Cálculo de distancia | Backend, entre centroides de celda |
| Exposición en API | **Bucket**: `< 2 km`, `2–5 km`, `5–10 km`, `+10 km` |
| Actualización | Al abrir la app; nunca en segundo plano |
| Historial | No se guarda historial de celdas del usuario |

### Implementación

```ts
// src/location/cell.ts
import { encode, decode } from "ngeohash";

const PRECISION = 5;                 // ~4.9 km

export function toCell(lat: number, lng: number): string {
  return encode(lat, lng, PRECISION);
}

export function cellCenter(cell: string): { lat: number; lng: number } {
  const { latitude, longitude } = decode(cell);
  return { lat: latitude, lng: longitude };
}

export function distanceBucket(a: string, b: string): string {
  const p = cellCenter(a), q = cellCenter(b);
  const km = haversine(p, q);
  if (km < 2)  return "< 2 km";
  if (km < 5)  return "2-5 km";
  if (km < 10) return "5-10 km";
  return "+10 km";
}
```

### Excepción: cita segura

La única ubicación exacta del sistema es la de una **sesión de cita segura activa**, y solo es
visible para **los contactos de confianza del propio usuario**, mediante un enlace con token, con
TTL de 24 h. El otro usuario del match **nunca** puede verla.

---

## 3. Capturas de pantalla

### La verdad incómoda

`expo-screen-capture` permite **bloquear** capturas en Android (`FLAG_SECURE`) y **detectar** en
iOS. No impide que alguien fotografíe la pantalla con otro teléfono. Cualquier promesa de "capturas
bloqueadas" es falsa.

### Estrategia en tres capas

| Capa | Qué hace | Qué aporta |
|---|---|---|
| **Bloqueo** | `preventScreenCaptureAsync()` en pantallas de chat y fotos | Detiene el 80 % de los casos casuales (Android) |
| **Detección** | Listener de captura/ grabación → `ScreenshotEvent` | Evidencia y telemetría para moderación |
| **Marca de agua** | ID de usuario + timestamp embebido de forma invisible en cada foto enviada | **La única que realmente disuade** |

La marca de agua se comunica de forma explícita al usuario en el primer chat:

> "Las fotos que envíes llevan una marca invisible que permite identificarlas si se difunden."

El deterrente psicológico funciona mejor que el técnico, y si algo se filtra, la marca te dice de
qué cuenta salió.

### Límite de responsabilidad

La app advierte, disuade y registra. **No puede impedir** que alguien haga una foto de su pantalla
con otro teléfono. La política de privacidad debe decirlo con claridad.

---

## 4. Cita segura ("botón de pánico")

### Máquina de estados

```
        ┌────────────┐
        │   ACTIVE   │◄──── check-in "estoy bien"
        └─────┬──────┘
              │ vence nextCheckIn sin respuesta
              ▼
        ┌────────────┐
        │ CHECKIN_DUE│──── responde ──► ACTIVE
        └─────┬──────┘
              │ +10 min sin respuesta
              ▼
        ┌────────────┐
        │  ALERTED   │──► notifica a contactos con última ubicación
        └─────┬──────┘
              │ usuario responde / cierra
              ▼
        ┌────────────┐
        │   ENDED    │
        └────────────┘

   Cualquier estado ──[pánico]──► PANIC  (alerta inmediata + llamada sugerida)
```

### Requisitos

| Requisito | Detalle |
|---|---|
| **Solo comparte tu ubicación** | Nunca la del otro. Permitir rastrear al match sería crear el arma que se quiere evitar |
| **Consentimiento explícito** | Se activa manualmente, con rostro fresco + PIN |
| **TTL** | La sesión caduca sola (máx. 8 h) y los pings se borran a las 24 h |
| **Sin instalar app** | El contacto recibe un enlace público firmado que abre en el navegador |
| **Funciona sin datos** | El pánico debe salir también por SMS como respaldo |
| **Check-ins con hora** | Cada 30–60 min, configurables |
| **Datos del match en la alerta** | Nombre, foto, última ubicación conocida del local (no la del usuario si no la compartió) |

### Enlaces de emergencia (Colombia)

| Línea | Para qué |
|---|---|
| **123** | Emergencias (Policía / ambulancia) |
| **155** | Línea de atención a mujeres víctimas de violencia |
| **141** | ICBF — protección de menores |

Estos números se muestran **siempre** en la pantalla de cita segura, incluso sin sesión activa. No
dependen de tu backend.

### Aviso legal en la pantalla

> "Esta función comparte tu ubicación con tus contactos de confianza mientras está activa. No
> reemplaza una llamada a emergencias."

---

## 5. Bloqueo, reporte y moderación

Sin esto, la verificación de identidad solo garantiza que el agresor es quien dice ser.

| Función | Especificación |
|---|---|
| **Bloqueo** | Inmediato, bidireccional, silencioso (el otro no lo sabe). Elimina el match y el chat |
| **Reporte** | Motivos: suplantación, acoso, contenido sexual no solicitado, menor de edad, estafa, otro. Adjunta evidencia (capturas, mensajes) |
| **Evidencia** | Al reportar, se congelan los últimos N mensajes para revisión (no se borran con el chat) |
| **Prioridad** | "Menor de edad" y "amenaza" → cola prioritaria, SLA 1 h |
| **Consecuencia** | Advertencia → limitación → suspensión → expulsión. La expulsión **no** borra la plantilla: queda en lista de bloqueo para que el 1:N impida el re-registro |
| **Apelación** | Todo usuario expulsado puede apelar una vez, con revisión humana |

### Lista de bloqueo biométrica

Cuando se expulsa a alguien por suplantación o por ser menor, **la plantilla se conserva en una
lista de bloqueo** (con base legal y plazo definido, ver doc 05). El próximo registro con esa cara
devuelve `IDENTITY_REVIEW` genérico y no crea cuenta. Sin esto, el 1:N en el alta no sirve para
nada: el expulsado simplemente vuelve con otro email.

---

## 6. Lo que este documento deliberadamente NO hace

| No se hace | Por qué |
|---|---|
| Rastrear la ubicación del match | Convierte la app en herramienta de vigilancia |
| Compartir ubicación en tiempo real con el otro | Idem |
| Verificar antecedentes penales | Legalmente riesgoso y discriminatorio en Colombia |
| Analizar el contenido de los chats con IA | Costo, falsos positivos, y el usuario no lo pidió |
| "Modo invisible" que oculte que estás en línea | Falsa sensación de seguridad; la app de mensajería siempre revela patrones |

---

## 7. Métricas de esta capa

| Métrica | Objetivo |
|---|---|
| Fotos rechazadas por 3D:2D / fotos subidas | 3–8 % (sano: rechaza lo falso sin torturar a los reales) |
| Reportes por 1.000 matches | ≤ 15 |
| Reportes resueltos en < 24 h | ≥ 90 % |
| Sesiones de cita segura / matches con encuentro | Instrumentar, sin objetivo inicial |
| Alertas de pánico con respuesta | 100 % notificadas |
