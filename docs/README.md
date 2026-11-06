# DateApp — Documentación del proyecto

**Última actualización:** 2026-11-06
**Estado:** en desarrollo — paso 1 del MVP implementado (registro por invitación + OTP)
**Decisión pendiente:** proveedor de identidad (ver [03-spike-kyc.md](03-spike-kyc.md))

---

## Qué es esto

App de citas cuyo diferencial es la **verificación de identidad obligatoria**: cada perfil
corresponde a una persona real, con documento verificado y rostro cotejado. El objetivo
declarado es **eliminar el catfishing**.

Dos repositorios:

| Repo | Ruta | Stack | Estado |
|---|---|---|---|
| Backend | este repo (`docs/` vive aquí) | Express 4 · TypeScript · Prisma 7 · PostgreSQL | Registro cerrado + OTP |
| App | `../../MiAppDeCitas` | Expo SDK 58 · React Native 0.88 | Pantalla de diagnóstico |

> Esta carpeta está versionada en `mi-app-backend` (ADR-010). Los enlaces internos son relativos
> y funcionan igual en GitHub que en disco.

---

## Cómo leer esta documentación

> **Si vas a escribir código, empieza por
> [00-mvp-sin-presupuesto.md](00-mvp-sin-presupuesto.md).** Esa es la guía de trabajo: alcance
> recortado, costo cero y verificable por una persona. Los documentos 01–06 describen el producto a
> escala y quedan como visión de largo plazo (ver ADR-009).

Si quieres el panorama completo, en este orden:

1. **[01-vision-y-modelo-de-confianza.md](01-vision-y-modelo-de-confianza.md)** — qué promete el
   producto, qué no, y la escalera de verificación L0–L5. Es la base de todo lo demás.
2. **[02-arquitectura-autenticacion.md](02-arquitectura-autenticacion.md)** — flujos, endpoints y
   modelo de datos.
3. **[03-spike-kyc.md](03-spike-kyc.md)** — evaluación de proveedores y la decisión que falta.
4. **[06-roadmap.md](06-roadmap.md)** — en qué orden se construye.

Si vas a escribir código, además:

- **[04-seguridad-de-usuarios.md](04-seguridad-de-usuarios.md)** — ubicación difusa, capturas,
  cita segura. Tiene especificaciones concretas, no ideas.
- **[05-privacidad-y-legal-co.md](05-privacidad-y-legal-co.md)** — obligaciones sobre datos
  biométricos en Colombia.

Si vas a decidir algo, revisa antes **[07-decisiones-adr.md](07-decisiones-adr.md)**: ahí está el
registro de lo ya decidido y por qué. No reabras una decisión sin leer su ADR.

---

## Índice

| Archivo | Contenido |
|---|---|
| [00-mvp-sin-presupuesto.md](00-mvp-sin-presupuesto.md) | **Guía de trabajo actual.** Alcance, flujo, endpoints, costos $0 |
| [01-vision-y-modelo-de-confianza.md](01-vision-y-modelo-de-confianza.md) | Alcance, promesa, niveles L0–L5, insignias, métricas |
| [02-arquitectura-autenticacion.md](02-arquitectura-autenticacion.md) | Flujos KYC y login, endpoints, JWT, modelo de datos |
| [03-spike-kyc.md](03-spike-kyc.md) | Candidatos, criterios, precios, recomendación, plan de 5 días |
| [04-seguridad-de-usuarios.md](04-seguridad-de-usuarios.md) | Anti-catfish, ubicación difusa, capturas, cita segura |
| [05-privacidad-y-legal-co.md](05-privacidad-y-legal-co.md) | Ley 1581, SIC, consentimiento, retención, checklist |
| [06-roadmap.md](06-roadmap.md) | Fases, entregables, criterios de aceptación |
| [07-decisiones-adr.md](07-decisiones-adr.md) | ADR-001 a ADR-010 |
| [spike/matriz-proveedores.xlsx](spike/matriz-proveedores.xlsx) | Matriz de scoring y modelo de costos editable |
| [spike/protocolo-pruebas-rostro.md](spike/protocolo-pruebas-rostro.md) | Guion de pruebas con personas reales |

---

## Convenciones

- **Fecha de caducidad de la información:** todo dato de precios o de proveedor lleva fecha. Los
  precios de KYC cambian cada trimestre; si un número tiene más de 90 días, se vuelve a verificar
  antes de decidir con él.
- **Lo que dice una fuente externa** se cita con enlace. Lo que es decisión propia se marca como
  decisión y vive en un ADR.
- **Este directorio vive en el repositorio del backend** (`mi-app-backend/docs/`). La app enlaza
  aquí desde su README porque la arquitectura es transversal. Si algún día se unifican en un
  monorepo, se mueve tal cual (ver ADR-010).
