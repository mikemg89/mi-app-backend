# 01 · Visión y modelo de confianza

**Estado:** cerrado · **Última revisión:** 2026-11-05

---

## 1. El problema

En una app de citas el atacante no busca tumbar el servidor: busca **construir un perfil falso
creíble**. Catfishing es suplantar identidad con fotos ajenas para manipular, extorsionar o
estafar. Ningún WAF, ningún rate limit y ninguna contraseña fuerte detienen eso, porque el ataque
ocurre en el contenido del perfil, no en la infraestructura.

La tesis del producto: **si cada perfil está atado a un documento de identidad y a una cara
verificada en vivo, el catfishing deja de ser rentable.** No imposible — rentable es la palabra
correcta, y por eso hay que medirlo (§5).

---

## 2. Lo que el producto promete (y lo que no)

| | Garantía | Cómo se obtiene |
|---|---|---|
| ✅ | Hay una **persona física viva** en el momento de la verificación | Prueba de vida con detección de inyección de cámara |
| ✅ | Presentó un **documento de identidad auténtico** | OCR + validación de seguridad del documento |
| ✅ | Su cara = la del documento = **la de cada foto del perfil** | Cotejo 3D:2D por foto |
| ✅ | Esa cara **no está en otra cuenta** | Búsqueda 1:N en el alta |
| ✅ | Es **mayor de edad** según su documento | Fecha de nacimiento del OCR, no autodeclarada |
| ❌ | Que sea una buena persona | Fuera del alcance de cualquier sistema técnico |
| ❌ | Que la foto tenga menos de un año | Mitigado con re-verificación, no garantizado |
| ❌ | Que no esté casada, que no sea estafadora, que no mienta en su bio | Fuera de alcance |

**Regla de comunicación:** la insignia nunca dice "seguro" ni "100 % confiable". Dice **qué se
verificó y cuándo**: `Identidad verificada · 5 nov 2026`. Prometer más es un riesgo legal
(la SIC sanciona la información engañosa) y una decepción garantizada cuando ocurra el primer
incidente.

---

## 3. La escalera de confianza L0–L5

La verificación no es un booleano: es un conjunto de atestaciones, cada una con requisito, caducidad
y desbloqueo propios.

| Nivel | Nombre | Requisito | Desbloquea | Caduca |
|---|---|---|---|---|
| **L0** | Anónimo | Nada | Ver perfiles del mazo (fotos desenfocadas, sin distancia, sin bio completa) | — |
| **L1** | Cuenta | Email + teléfono con OTP | Editar perfil, subir fotos (quedan en revisión) | 90 días |
| **L2** | Documento | OCR + autenticidad + selfie vs foto del documento + mayoría de edad | Aparecer en el mazo, insignia base | 2 años o cambio de documento |
| **L3** | Sesión biométrica | Plantilla 3D enrolada + 1:1 en cada login | Dar like, match, chatear | Por sesión |
| **L4** | Fotos verificadas | Cada foto publicada cotejada 3D:2D contra la plantilla | Insignia "fotos reales" | 6 meses |
| **L5** | Dispositivo confiable | Atestación Play Integrity / App Attest | No re-verificar en ese equipo | 90 días |

### Regla de producto

> **Se puede mirar desde L0. Para aparecer e interactuar se exige L2 + L3 + L4.**

Esto resuelve el conflicto entre embudo y seguridad: la verificación se cobra al final del embudo
(cuando la persona ya quiere usar la app), no en la puerta de entrada. Verificar al inicio cuesta
entre 30 % y 50 % de abandono; verificando al momento de interactuar, ese costo se paga cuando ya
hay intención.

### Transiciones permitidas

```
L0 → L1  registro + OTP
L1 → L2  KYC (documento + rostro)         ← obligatorio para todos
L2 → L3  primer login con rostro
L3 → L4  cotejo de cada foto publicada
L4 → L5  atestación del dispositivo
```

**Degradación** (nunca borrado automático):

| Situación | Efecto |
|---|---|
| Falla la re-verificación de fotos a los 6 meses | Baja a L3; deja de aparecer en el mazo hasta re-verificar |
| Login desde dispositivo nuevo | Sigue en L3, pero exige rostro; el dispositivo queda en revisión |
| Documento vencido | Baja a L1 con aviso de 30 días |
| Reportes graves confirmados | Suspensión (estado `SUSPENDED`), no baja de nivel |

---

## 4. Qué ve el usuario: insignias

Una sola insignia no comunica nada. Se muestran tres, con fecha en el detalle:

| Insignia | Significado | Se muestra |
|---|---|---|
| 🪪 **Identidad** | Documento verificado + cara coincide | En la tarjeta del mazo |
| 🤳 **Fotos reales** | Todas las fotos publicadas cotejadas con la plantilla | En la tarjeta y en el perfil |
| 🕒 **Verificado hace X** | Fecha de la última verificación completa | En el perfil, al tocar la insignia |

Un perfil que no alcanza L2 no aparece. No hay perfiles "sin verificar" en el mazo: eso es lo que
diferencia esta app.

---

## 5. Métricas de éxito

Sin medición, "seguridad" es una opinión. Estas son las que importan, con objetivo inicial para el
primer trimestre en producción:

| Métrica | Definición | Objetivo |
|---|---|---|
| **Tasa de alta completa** | Registros que llegan a L2 / registros iniciados | ≥ 55 % |
| **Tiempo a L2** | Mediana de minutos desde el registro hasta la verificación | ≤ 4 min |
| **Falso rechazo (FRR)** | Usuarios legítimos que no logran verificar tras 3 intentos | ≤ 5 % |
| **Falso positivo (FAR)** | Verificaciones aprobadas que deberían haber fallado (auditoría manual de muestra) | ≤ 1 % |
| **Reintentos por alta** | Media de intentos hasta el éxito | ≤ 1.8 |
| **Abandono en KYC** | Personas que inician el KYC y no lo terminan | ≤ 35 % |
| **Reportes de catfishing post-verificación** | Reportes confirmados de suplantación por 1.000 usuarios activos | ≤ 0.5 |
| **Tiempo de resolución de un caso** | Reporte → acción | ≤ 24 h |

La métrica que de verdad mide si el producto funciona es la última fila. Las demás son la salud del
embudo.

---

## 6. Fuera de alcance (excluido a propósito)

- Verificación de antecedentes penales: legalmente complejo y discriminatorio en Colombia.
- Verificación de ingresos o patrimonio: cambia el producto a algo que no es.
- Reconocimiento facial en video en tiempo real durante el chat: costo prohibitivo y sin evidencia
  de que reduzca el riesgo.
- Rastreo de ubicación del otro usuario: **prohibido por diseño** (ver 04).

---

## 7. Decisiones reflejadas en este documento

| ADR | Decisión |
|---|---|
| ADR-002 | Verificación obligatoria para todos; no hay modo "solo mirar" permanente |
| ADR-003 | Verificación de documento en el registro, no solo rostro |
| ADR-004 | Búsqueda 1:N habilitada en el alta |
| ADR-005 | Ubicación difusa; nunca coordenadas exactas |
