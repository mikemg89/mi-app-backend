# 06 · Roadmap

**Última revisión:** 2026-11-05 · **Supuesto:** una sola persona, dedicación parcial.
Las duraciones son **semanas de trabajo efectivo**, no calendario.

---

## Principio de orden

Se construye de adentro hacia afuera: primero la identidad (lo que hace único al producto),
después el dominio social (lo que hace que se use). El riesgo grande —que la verificación no
funcione o no se pueda pagar— se resuelve **antes** de escribir la app.

```
Spike ──► Auth sin rostro ──► KYC ──► Login biométrico ──► Fotos verificadas ──► Dominio ──► Lanzamiento
 1 sem        2 sem           3 sem        2 sem               2 sem              4 sem         2 sem
```

---

## Fase 0 · Spike de proveedor

| | |
|---|---|
| **Duración** | 5 días |
| **Depende de** | Nada |
| **Entregable** | [spike/matriz-proveedores.xlsx](spike/matriz-proveedores.xlsx) llena + ADR-006 |
| **Criterio de aceptación** | Un proveedor elegido con FRR, latencia y resistencia a ataques medidos |

Tareas:
- [ ] Abrir cuentas de prueba (2 finalistas).
- [ ] Confirmar cobertura de CC, PPT y pasaporte por escrito.
- [ ] Development build con el SDK.
- [ ] Ejecutar [protocolo de pruebas](spike/protocolo-pruebas-rostro.md).
- [ ] Llenar la matriz y decidir.

**Riesgo de fase:** si ningún proveedor pasa, se replantea el alcance antes de seguir.

---

## Fase 1 · Autenticación sólida (sin rostro)

| | |
|---|---|
| **Duración** | 2 semanas |
| **Depende de** | — |
| **Entregable** | Ciclo de sesión completo y probado |

- [ ] `POST /api/auth/refresh` con rotación y detección de reuso de familia.
- [ ] `POST /api/auth/logout`.
- [ ] `GET /api/auth/me`.
- [ ] Middleware `requireAuth` (valida `amr`, `auth_time`, `did`).
- [ ] Códigos de error estables (`code`) en toda la API.
- [ ] Rate limit por ruta (login más estricto) + bloqueo progresivo.
- [ ] Recuperación de contraseña por email (con su propio diseño de seguridad).
- [ ] Tests: refresh, reuso, expiración, bloqueo. Base de datos de test aislada.
- [ ] Script `npm run check` en CI.

**Criterio de aceptación:** suite verde en CI sin base de datos compartida; un refresh reutilizado
revoca la familia completa (test explícito).

---

## Fase 2 · KYC en el registro

| | |
|---|---|
| **Duración** | 3 semanas |
| **Depende de** | Fase 0 y Fase 1 |
| **Entregable** | Un usuario puede pasar de L1 a L2 |

- [ ] Puerto `IdentityProvider` + adaptador del proveedor + **mock** para tests.
- [ ] `IdentitySession` y sus estados.
- [ ] Endpoint de documento con validación de edad.
- [ ] Enrolamiento + **1:N** con respuesta neutra.
- [ ] `VerificationEvent` y `LoginAttempt`.
- [ ] Pantallas: consentimiento, captura de documento, selfie, resultado.
- [ ] Manejo de errores de cámara/permisos (el 30 % de los abandonos viven aquí).

**Criterio de aceptación:** 95 % de altas válidas en < 90 s; un caso de 1:N no revela información;
el flujo se puede completar en un Android de gama media.

---

## Fase 3 · Login biométrico

| | |
|---|---|
| **Duración** | 2 semanas |
| **Depende de** | Fase 2 |
| **Entregable** | Login en dos fases con challenge |

- [ ] `LoginChallenge` single-use con TTL 5 min.
- [ ] `POST /auth/face/verify` + `POST /auth/login/complete`.
- [ ] `Device` + atestación (Play Integrity / App Attest).
- [ ] Step-up con `auth_time` para acciones sensibles.
- [ ] Pantalla de captura facial en login + reintentos.
- [ ] Tests de replay, challenge expirado, dispositivo nuevo.

**Criterio de aceptación:** reutilizar un challenge falla; un dispositivo nuevo exige el flujo
completo; el login completo toma < 15 s en gama media.

---

## Fase 4 · Fotos verificadas y confianza

| | |
|---|---|
| **Duración** | 2 semanas |
| **Depende de** | Fase 2 |
| **Entregable** | L4 y las insignias |

- [ ] Cotejo 3D:2D en cada subida (bloqueante).
- [ ] Estados de foto: `REVIEW`, `PASS`, `FAIL` + cola de revisión.
- [ ] Insignias y fecha visible en el perfil.
- [ ] Job de re-verificación a 6 meses con degradación a L3.
- [ ] Subida de fotos con URLs firmadas y cifrado en reposo.

**Criterio de aceptación:** ninguna foto se publica sin `PASS`; una foto de otra persona se rechaza
con mensaje neutro.

---

## Fase 5 · Dominio social

| | |
|---|---|
| **Duración** | 4 semanas |
| **Depende de** | Fase 3 |
| **Entregable** | La app sirve para lo que existe |

- [ ] `Profile` + onboarding (nombre, bio, preferencias).
- [ ] Descubrimiento (mazo) con filtros y **distancia en buckets**.
- [ ] Like / match.
- [ ] Chat (tiempo real o polling con WebSocket).
- [ ] Bloqueo y reporte con congelado de evidencia.
- [ ] Moderación: cola, SLA, consecuencias.

**Criterio de aceptación:** dos usuarios pueden registrarse, verificarse, hacer match y chatear sin
intervención manual.

---

## Fase 6 · Lanzamiento

| | |
|---|---|
| **Duración** | 2 semanas |
| **Depende de** | Fase 5 |
| **Entregable** | App en tiendas + operación |

- [ ] Cita segura y botón de pánico.
- [ ] Detección de capturas + marca de agua.
- [ ] Política de privacidad, consentimientos y jobs de retención.
- [ ] EAS build + firma + ficha de tienda.
- [ ] Logs estructurados, alertas, backups probados.
- [ ] Prueba de penetración.
- [ ] Revisión legal final.

**Criterio de aceptación:** checklist de [05-privacidad-y-legal-co.md](05-privacidad-y-legal-co.md) §10 completo.

---

## Backlog priorizado

### P0 — sin esto no hay producto
1. Refresh con rotación + logout + `requireAuth`.
2. KYC (documento + rostro + 1:N).
3. Login biométrico.
4. Fotos 3D:2D.
5. Bloqueo/reporte.

### P1 — sin esto el producto no se usa
6. Descubrimiento, match, chat.
7. Ubicación difusa.
8. Recuperación de cuenta.
9. Moderación con SLA.

### P2 — diferencial
10. Cita segura.
11. Marca de agua y anti-capturas.
12. Verificación de dispositivo (L5).
13. Exportación de datos (derechos del titular).

---

## Riesgos del plan

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Integración RN del SDK más difícil de lo previsto | +2 semanas | Probar en Fase 0, no en Fase 2 |
| El proveedor cambia precios | Medio | Puerto + revisión trimestral |
| Fase 5 se come el tiempo | Alto | Es la parte menos diferencial: usar librerías, no reinventar |
| Burnout de una sola persona | **Alto** | Cada fase termina en algo demostrable |

---

## Qué se puede mostrar al final de cada fase

| Fase | Demo |
|---|---|
| 1 | Login con refresh persistente y logout en todas las sesiones |
| 2 | "Subí mi cédula y me verificaron" |
| 3 | "Entré con mi cara" |
| 4 | "Mis fotos están verificadas y se ve la fecha" |
| 5 | "Hice match y hablé" |
| 6 | "Fui a una cita con la función de seguridad activa" |
