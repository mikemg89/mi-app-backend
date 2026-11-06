# 05 · Privacidad y marco legal (Colombia)

**Estado:** borrador de trabajo · **Última revisión:** 2026-11-05

> ⚠️ **Esto no es asesoría legal.** Es un mapa de los temas que hay que resolver y de las
> decisiones de diseño que la ley condiciona. Antes de lanzar, un abogado especializado en
> protección de datos debe revisar el texto de consentimiento y la política de tratamiento.
> Contratarlo cuesta menos que una sanción de la SIC.

---

## 1. Por qué esto no es un anexo, es arquitectura

Los datos biométricos son **datos personales sensibles**. Eso no cambia solo el aviso de
privacidad: cambia **dónde se guarda la plantilla, cuánto se retiene, quién la ve y cómo se borra**.
Si eliges arquitectura primero y lees la ley después, vas a reescribir el módulo de identidad.

---

## 2. Marco normativo aplicable

| Norma | Qué establece | Impacto en el producto |
|---|---|---|
| **Ley 1581 de 2012** | Régimen general de protección de datos | Autorización, finalidad, derechos del titular, deber de seguridad |
| **Decreto 1377 de 2013** | Reglamenta la Ley 1581 | Contenido del aviso de privacidad y de la autorización; datos sensibles |
| **Ley 1266 de 2008** | Habeas data financiero | No aplica salvo que se manejen datos de crédito |
| **Circular 01 de 2025 (SIC)** | Lineamientos de tratamiento de datos en servicios digitales (fintech) | Criterio vigente del regulador sobre biometría: consentimiento explícito, no compartir con terceros, borrado al terminar la relación ([análisis](https://www.lafm.com.co/economia/superindustria-fija-nuevas-reglas-para-el-manejo-de-datos-en-servicios-fintech-378052)) |
| **Resolución 71154 de 2025 (SIC)** | Instrucciones sobre tratamiento de datos en servicios digitales | Verificar aplicabilidad directa; el texto está en [sic.gov.co](https://www.sic.gov.co/sites/default/files/RE71154-2025.pdf) |
| **Estatuto del Consumidor (Ley 1480)** | Información veraz y suficiente | Prohíbe prometer "100 % seguro" o "identidad garantizada" |

### Lo que la SIC ha señalado explícitamente sobre biometría

Según su circular de 2025, cuando se usan huellas o reconocimiento facial el titular debe:

1. Ser informado de **las finalidades**.
2. Dar **autorización explícita**.
3. Recibir garantías de que **no se usarán para propósitos no autorizados**.
4. Saber que **no se comparten con terceros** ni alimentan bases centralizadas.
5. Que los datos se **eliminen** cuando termine la relación contractual.

Ese punto 4 es el que tensiona con un proveedor hospedado: si el proveedor guarda la plantilla,
tú estás compartiendo biometría con un tercero. No es ilegal, pero exige **contrato de encargado
del tratamiento**, informarlo en el aviso y justificarlo. Es un argumento real a favor de
autoalojar cuando el volumen lo permita.

---

## 3. Base legal de cada tratamiento

| Tratamiento | Base | Observación |
|---|---|---|
| Email y teléfono | Ejecución del contrato | Necesario para la cuenta |
| Documento de identidad | **Consentimiento explícito** | Dato sensible |
| Rostro / plantilla | **Consentimiento explícito** | Dato sensible; debe ser específico y separado |
| Ubicación (celda) | Consentimiento | Se puede usar la app sin ubicación, con funcionalidad reducida |
| Ubicación exacta (cita segura) | Consentimiento | Solo durante la sesión, TTL 24 h |
| Datos de uso | Interés legítimo / consentimiento | Analítica agregada |
| Lista de bloqueo biométrica | **Interés legítimo + obligación de seguridad** | Requiere análisis: conservar una plantilla de alguien que ya no es usuario es el punto más delicado del sistema |

### El punto más delicado: la lista de bloqueo

Conservar la plantilla de un usuario expulsado **después** de terminar la relación contradice el
criterio de "eliminar al terminar la relación". La justificación es la seguridad de los demás
usuarios y la prevención de reincidencia. Para que sea defendible:

- Plazo máximo definido (p. ej. **2 años**), no indefinido.
- Acceso restringido y auditado.
- Se guarda **solo** el hash de la plantilla / referencia, con el propósito único de bloqueo.
- Se informa en el aviso de privacidad **antes** del registro.
- Se documenta en la evaluación de impacto.

Si un abogado objeta esta práctica, la alternativa es el bloqueo por documento (hash del número),
que es menos invasivo aunque más fácil de evadir. **Decidir con asesoría antes de implementar.**

---

## 4. Consentimiento: qué debe decir el texto

No sirve un check al final de un documento de 40 páginas. Debe ser:

- **Explícito y separado** del resto de términos.
- **Informado**: qué se captura, para qué, quién lo procesa, cuánto se guarda.
- **Granular**: documento, rostro y ubicación son consentimientos distintos.
- **Registrado**: guardar versión del texto, fecha, IP y dispositivo (esto es evidencia).
- **Revocable**: aunque revocar el consentimiento biométrico implica no poder usar la app.

### Estructura mínima de la pantalla de consentimiento

```
┌─────────────────────────────────────────────────────────┐
│ Para verificar tu identidad necesitamos:                │
│                                                         │
│ • Una foto de tu documento de identidad                 │
│ • Una selfie con prueba de vida                         │
│                                                         │
│ Qué hacemos con eso:                                    │
│ • Verificamos que eres quien dices ser (1 sola vez)     │
│ • Guardamos una referencia cifrada de tu rostro para    │
│   compararla en cada inicio de sesión                   │
│ • NO guardamos la foto de tu documento                  │
│ • NO la compartimos con anunciantes ni con terceros     │
│   distintos a [PROVEEDOR], que actúa por nuestra cuenta │
│                                                         │
│ Puedes borrar tus datos en cualquier momento desde      │
│ Ajustes → Eliminar cuenta.                              │
│                                                         │
│ [ ] Autorizo el tratamiento de mis datos biométricos    │
│     (obligatorio para usar la app)                      │
│                                                         │
│ Ver política de tratamiento completa                     │
└─────────────────────────────────────────────────────────┘
```

Traducir esto a **la app**, no a un PDF.

---

## 5. Retención y borrado

| Dato | Retención | Borrado |
|---|---|---|
| Email, teléfono | Mientras la cuenta exista | Al eliminar cuenta: 30 días de gracia, luego purga |
| Imagen del documento | **30 días** (o inmediato si el proveedor no la devuelve) | Job programado |
| Metadatos del documento (tipo, hash, resultado) | 2 años | Purga |
| Plantilla facial | Mientras la cuenta exista | API del proveedor + verificación |
| Plantilla en lista de bloqueo | 2 años | Purga automática |
| Mensajes | Mientras el chat exista | Al borrar el chat o la cuenta |
| Ubicación (celda) | Sobrescrita en cada actualización | Sin historial |
| Pings de cita segura | 24 h | TTL |
| Intentos de login | 12 meses | Purga |
| Eventos de verificación | 2 años | Archivar y purgar |

**Requisito técnico:** cada tabla con retención necesita un job que borre de verdad, con registro de
ejecución. Un `DELETE` sin job es una promesa, no una práctica.

---

## 6. Terceros (encargados del tratamiento)

| Tercero | Qué datos ve | Instrumento |
|---|---|---|
| Proveedor de identidad | Documento, selfie, plantilla | DPA + cláusulas de retención y borrado |
| Cloud / hosting | Todo lo cifrado | DPA del proveedor cloud |
| Almacenamiento de fotos (S3 o similar) | Fotos de perfil | Cifrado + URLs firmadas de corta vida |
| Analítica | Eventos, nunca biometría ni PII | Anonimización |
| Mensajería (email/SMS) | Email, teléfono | DPA |

**Regla:** ningún SDK de terceros en la app que pueda leer el almacenamiento seguro. Revisar
permisos de cada dependencia antes de publicar.

---

## 7. Obligaciones formales en Colombia

| Obligación | Cuándo aplica | Esfuerzo |
|---|---|---|
| **Política de tratamiento** publicada | Siempre | Bajo |
| **Aviso de privacidad** en la app | Siempre | Bajo |
| **Registro Nacional de Bases de Datos (RNBD)** ante la SIC | Cuando la base supera los umbrales de la normativa | Medio |
| **Evaluación de impacto (PIA)** | Tratamiento de datos sensibles a gran escala | Medio-alto |
| **Delegado de protección de datos (DPO)** | No obligatorio para particulares, recomendable al crecer | — |
| **Procedimiento de derechos del titular** | Siempre | Medio |
| **Registro de actividades de tratamiento** | Siempre | Bajo |

### Derechos del titular implementados como endpoints

| Derecho | Implementación |
|---|---|
| Conocer | `GET /api/privacy/my-data` — export JSON con todo lo que se guarda |
| Actualizar | `PATCH /api/profile` |
| Rectificar | `PATCH /api/profile` + flujo de soporte para datos de identidad |
| Suprimir | `DELETE /api/account` — borra cuenta, plantilla y fotos en 30 días |
| Revocar autorización | `POST /api/privacy/revoke` — implica cierre de cuenta |
| Presentar queja | Enlace a la SIC en la app |

El borrado de cuenta **debe ser self-service**. Obligar a escribir un correo es la forma más común
de incumplir.

---

## 8. Menores de edad

| Medida | Implementación |
|---|---|
| Verificación de edad | Fecha de nacimiento del **documento**, no autodeclarada |
| Bloqueo | < 18 → `403 UNDERAGE`, cuenta bloqueada, sin acceso |
| Re-registro | El documento y la cara entran en lista de bloqueo de menores (retención corta, propósito único) |
| Reporte | Botón "es menor de edad" en cada perfil → cola prioritaria |
| Contenido | Sin categorías para adultos |

Una app de citas con biometría de menores es un riesgo reputacional y legal que ninguna
funcionalidad justifica.

---

## 9. Medidas de seguridad exigibles (y demostrables)

| Medida | Estado |
|---|---|
| Cifrado en tránsito (TLS 1.2+) | Pendiente |
| Cifrado en reposo de fotos y documentos | Pendiente |
| Cifrado de la referencia de plantilla con clave gestionada | Pendiente |
| Hashing con pepper para números de documento | Pendiente |
| Acceso a datos sensibles con mínimo privilegio y auditoría | Pendiente |
| Registro de accesos a datos biométricos | Pendiente |
| Borrado verificado (job + log) | Pendiente |
| Copias de seguridad cifradas y con retención limitada | Pendiente |
| Revisión de dependencias (SCA) en CI | Pendiente |
| Prueba de penetración antes de lanzar | Pendiente |

---

## 10. Checklist antes de publicar

- [ ] Política de tratamiento redactada y publicada con URL estable.
- [ ] Aviso de privacidad dentro de la app, accesible sin iniciar sesión.
- [ ] Pantalla de consentimiento granular con registro de versión y fecha.
- [ ] DPA firmado con el proveedor de identidad.
- [ ] Contrato con el proveedor cloud con cláusulas de datos.
- [ ] Jobs de retención implementados y probados.
- [ ] Borrado de cuenta self-service funcionando (y borra la plantilla).
- [ ] Evaluación de impacto documentada.
- [ ] RNBD evaluado (¿aplica? ¿cuándo?).
- [ ] Textos revisados por abogado.
- [ ] Revisión de que ningún texto promete "100 % seguro".
- [ ] Ficha de tienda con la cláusula de datos biométricos.
- [ ] Procedimiento interno para incidentes de seguridad (72 h de notificación).

---

## 11. Riesgos legales abiertos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Lista de bloqueo biométrica sin base sólida | **Alta** | Plazo definido + PIA + asesoría |
| Proveedor hospedado guardando biometría sin DPA | Alta | DPA antes de firmar; verificar retención |
| Menor detectado tarde | Alta | Verificación en el registro, no después |
| Consentimiento "de paquete" | Media | Granular y separado |
| Promesas de seguridad exageradas | Media | Lenguaje de la insignia (doc 01) |
| Datos de salud o religión en el perfil (campos libres) | Media | Moderación + no pedirlos |
