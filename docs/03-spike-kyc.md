# 03 · Spike de proveedor de identidad

**Objetivo:** elegir el proveedor que hará documento + prueba de vida + 1:1 + 1:N con el menor
riesgo y el menor costo para un proyecto personal.
**Plazo:** 5 días de trabajo efectivo. **Fecha de este análisis:** 2026-11-05.
**Estado:** análisis hecho · **decisión pendiente de las pruebas con personas reales.**

> Los precios de KYC cambian cada trimestre y casi ninguno se publica. Todo número de este
> documento lleva fecha; si tiene más de 90 días, se vuelve a verificar antes de decidir con él.

---

## 1. Restricciones reales (las que descartan opciones)

| Restricción | Consecuencia |
|---|---|
| **Proyecto personal, sin empresa** | Los proveedores *sales-gated* (piden NIT, contrato, mínimo mensual) quedan fuera o al final. Hace falta **autoservicio con tarjeta**. |
| **Presupuesto por verificación aún sin definir** | La decisión no puede depender de un precio que no se conoce: se diseña para que el costo marginal sea bajo y se pueda cambiar |
| **Colombia** | Obligatorio soportar **cédula amarilla, cédula digital, PPT y pasaporte**. El PPT es poco común entre proveedores globales |
| **Expo / React Native** | El SDK debe tener integración RN usable. Ninguno tiene módulo Expo oficial: **todos requieren development build** |
| **Datos biométricos = sensibles** | Se prefiere que la plantilla no salga de infraestructura propia, o que el proveedor tenga borrado real y DPA |
| **Una sola persona manteniendo** | Un servidor Docker con upgrades cada 90 días (modelo FaceTec) es carga operativa que compite con desarrollar el producto |

---

## 2. Candidatos

### A. Didit (hospedado, autoservicio)
- API REST + SDKs; documento, prueba de vida, face match y búsqueda.
- Autoservicio con tarjeta: **el único del grupo que un particular puede contratar hoy sin hablar con ventas**.
- Cambió su esquema comercial el **1 de noviembre de 2026**: pasó de verificaciones gratis a un
  crédito mensual ([changelog](https://docs.didit.me/changelog/october-2026)). Verificar condiciones vigentes.
- **Riesgo:** cobertura real de cédula amarilla y PPT sin confirmar; empresa joven.

### B. Truora (hospedado, Colombia)
- Especialista en LatAm y **es la que mejor cubre documentos colombianos**; publica los tipos
  soportados en su [API de validación de documentos](https://dev.truora.com/validators/document_validation_api/).
- Su página de precios termina en **"Talk to sales"** ([truora.com/pricing](https://www.truora.com/en/pricing/)):
  requiere conversación comercial. Para un proyecto personal es fricción, no descarte.
- **Riesgo:** mínimo mensual o contrato anual.

### C. AWS Rekognition (Face Liveness + CompareFaces + Colecciones)
- Prueba de vida y comparación 1:1/1:N por API, facturado **por sesión de verificación** (cada
  reintento es una sesión nueva) y **por cara almacenada al mes** en las colecciones
  ([referencia de facturación](https://www.activepieces.com/blog/aws-rekognition-pricing-cost-per-feature-2026)).
- **No valida autenticidad de documentos**: habría que añadir otro proveedor solo para el documento.
- No hay componente RN oficial: el de Amplify es web.
- **Riesgo:** dos proveedores y más código propio para el flujo crítico.

### D. FaceTec (autoalojado)
- La referencia del sector en prueba de vida 3D; sus FaceMaps son la tecnología más resistente a
  ataques de presentación.
- **No es una librería: es un servidor** (Docker + MongoDB o PostgreSQL propios) que hace el
  matching; el backend queda como capa intermedia
  ([guía oficial](https://dev.facetec.com/technical-support-server-sdk-guides-setting-up-server-sdk)).
  Implica hardware, upgrades cada 90 días, despliegue blue/green y pruebas de carga.
- Licencia comercial: no es opción para presupuesto cero.
- **Riesgo:** operación de nivel producción a cargo de una persona.

### E. Stack abierto autoalojado (InsightFace + PaddleOCR + anti-spoof)
- Costo marginal **cero**; corre en una CPU modesta para volúmenes de MVP.
- El reconocimiento facial open source está a nivel de producción (modelos tipo `buffalo_l`).
- **La prueba de vida no.** Los modelos abiertos de anti-spoofing detectan fotos impresas y replay
  simple, pero **no** resisten inyección de cámara virtual ni ataques con deepfake bien hechos.
- Validar autenticidad de un documento colombiano (microtexto, holograma, UV) con OCR abierto: no.
- **Riesgo:** alto. Es exactamente la parte que no se puede improvisar si el producto promete seguridad.

---

## 3. Comparación

Pesos definidos en [spike/matriz-proveedores.xlsx](spike/matriz-proveedores.xlsx) (editables).

| Criterio | Peso | A. Didit | B. Truora | C. AWS | D. FaceTec | E. Abierto |
|---|---|---|---|---|---|---|
| Documento CO (CC, PPT, pasaporte) | 20 | 🟡 ? | 🟢 | 🔴 | 🟡 | 🔴 |
| Prueba de vida (resistencia real) | 20 | 🟡 ? | 🟡 | 🟢 | 🟢 | 🔴 |
| 1:N integrado | 12 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| 3D:2D contra fotos de perfil | 10 | 🟡 | 🟡 | 🟢 | 🟢 | 🟢 |
| Autoservicio (sin ventas) | 12 | 🟢 | 🔴 | 🟢 | 🔴 | 🟢 |
| Costo a escala MVP (500–5.000) | 10 | 🟢 | 🟡 | 🟢 | 🔴 | 🟢 |
| Operación para una persona | 8 | 🟢 | 🟢 | 🟡 | 🔴 | 🔴 |
| SDK React Native | 5 | 🟡 | 🟡 | 🔴 | 🟡 | 🟡 |
| Privacidad (datos no salen) | 3 | 🔴 | 🔴 | 🔴 | 🟢 | 🟢 |

> 🟢 cumple · 🟡 parcial o por confirmar · 🔴 no cumple
> **Los signos de interrogación son el trabajo del spike:** nadie puede responderlos leyendo una web.

---

## 4. Costo: cómo pensarlo con presupuesto indefinido

No se trata de "cuál es barato" sino de **cuánto cuesta el primer millar de usuarios verificados**.
El modelo completo está en la hoja `Costos` del Excel; estas son las variables que importan:

| Variable | Rango típico del mercado | Nota |
|---|---|---|
| Verificación de documento + rostro | USD 0,50 – 2,00 | El precio baja con volumen; casi nunca es público |
| Búsqueda 1:N | USD 0,05 – 0,50 por búsqueda | A veces incluida, a veces se cobra aparte |
| Re-verificación de fotos | depende del proveedor | Si se cobra por foto, es el rubro que se dispara |
| Almacenamiento de plantilla | USD 0,00 – 0,10 por usuario/mes | AWS cobra por cara almacenada |
| Infraestructura propia | USD 10 – 40 / mes | Solo en el modelo autoalojado |

**Tres escenarios para decidir:**

| Escenario | 500 usuarios | 5.000 usuarios | Comentario |
|---|---|---|---|
| **A. Hospedado autoservicio** a USD 1,00/alta | ~USD 500 una vez | ~USD 5.000 | El costo aparece cuando ya hay tracción |
| **B. Hospedado con volumen** a USD 0,50/alta | ~USD 250 | ~USD 2.500 | Requiere negociar, probablemente con empresa |
| **C. Autoalojado** | ~USD 15/mes | ~USD 40/mes | Barato en dinero, caro en riesgo y en horas |

**Conclusión económica:** en etapa MVP el costo **no es el factor decisivo** — 500 altas a USD 1
son menos que una semana de tu tiempo. El factor decisivo es **la calidad de la prueba de vida y la
cobertura del documento**, porque eso es lo que el producto está vendiendo.

---

## 5. Recomendación provisional

> **Ir con un proveedor hospedado y autoservicio para documento + prueba de vida, y validarlo con
> el protocolo de pruebas antes de firmar nada.** Si la cobertura de PPT o la tasa de falsos
> rechazos falla, el plan B es Truora (por cobertura) asumiendo la conversación comercial.

**Por qué no el autoalojado (aún):** el 80 % del riesgo de este producto está en la prueba de vida
y en la autenticidad del documento. Son justo las dos cosas que el código abierto no resuelve bien.
Autoalojar es una decisión para cuando haya volumen que lo justifique y alguien que cargue el pager.

**Por qué no FaceTec todavía:** su servidor propio es correcto para una fintech con equipo de
infraestructura, no para una persona sola que aún no ha lanzado.

**Condición de cambio:** si el spike muestra que el liveness del proveedor hospedado se rompe con
una foto en pantalla o un video, se descarta y se reevalúa FaceTec — porque entonces el proveedor
no está vendiendo lo que el producto promete.

---

## 6. Plan de 5 días

| Día | Actividad | Salida |
|---|---|---|
| **1** | Abrir cuentas de prueba en 2 finalistas (A y B/C). Verificar que un particular pueda contratar. Confirmar cobertura de CC, PPT y pasaporte **por escrito** | Lista corta de 2 |
| **2** | Montar development build de Expo con el SDK del finalista 1. Flujo mínimo: captura doc → selfie → resultado en pantalla | App de prueba funcionando |
| **3** | Protocolo de ataques: foto impresa, foto en pantalla, video replay, pantalla con video, gemelo, gafas, luz baja, contra luz | Tabla de resultados |
| **4** | Repetir día 3 con el finalista 2. Medir latencia p50/p95 y tasa de reintento | Tabla comparativa |
| **5** | Llenar la matriz con datos, calcular costo a 500/5.000, **decidir** y escribir ADR-006 | Decisión firmada |

Detalle de escenarios y métricas en [spike/protocolo-pruebas-rostro.md](spike/protocolo-pruebas-rostro.md).

### Criterios de aceptación (go / no-go)

Un proveedor pasa si cumple **todos**:

- [ ] Acepta cédula amarilla **y** PPT **y** pasaporte colombiano.
- [ ] Rechaza foto impresa, foto en pantalla de otro teléfono y video replay **en al menos 95 %** de los intentos.
- [ ] FRR ≤ 5 % en la muestra (incluyendo piel oscura y luz baja).
- [ ] Latencia p95 ≤ 12 s en Android de gama media.
- [ ] Devuelve un resultado **firmado** que el backend pueda verificar.
- [ ] Permite **borrar la plantilla** por API.
- [ ] Documenta retención y ofrece DPA.
- [ ] Se puede contratar sin empresa constituida.

Si ninguno cumple los tres primeros, la decisión correcta es **no lanzar la verificación todavía**
y replantear el alcance, no bajar el estándar.

---

## 7. Riesgos del spike

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El proveedor no cubre PPT | Media | Preguntarlo el día 1, antes de integrar |
| El liveness se rompe con un video del propio usuario | Media-alta | Es la prueba central del día 3 |
| Falsos rechazos en piel oscura | Media | Muestra diversa, umbrales ajustables |
| Costo real mucho mayor por reintentos | Media | Modelar con tasa de reintento medida, no con 1,0 |
| Lock-in: las plantillas no son portables | **Alta** | Asumirlo; cambiar de proveedor = todos re-enrolan. Por eso se elige una vez y bien |
| El proveedor desaparece | Baja-media | Puerto `IdentityProvider` + exportación de datos en el contrato |

**El lock-in es inevitable.** Las plantillas faciales son propietarias: no existe un formato
estándar para migrarlas. Cambiar de proveedor implica pedirle a **todos** los usuarios que se
vuelvan a verificar. Esa es la razón por la que este spike vale 5 días y no 5 horas.

---

## 8. Qué queda por confirmar (llenar al ejecutar)

| # | Pregunta | Respuesta | Fecha |
|---|---|---|---|
| 1 | ¿Cubre cédula amarilla? | | |
| 2 | ¿Cubre PPT? | | |
| 3 | ¿Cubre pasaporte? | | |
| 4 | ¿Precio por verificación a 500 y a 5.000? | | |
| 5 | ¿Cobra 1:N aparte? | | |
| 6 | ¿Cobra re-verificación de fotos? | | |
| 7 | ¿Resultado firmado verificable en servidor? | | |
| 8 | ¿Borrado de plantilla por API? | | |
| 9 | ¿Retención por defecto? | | |
| 10 | ¿Contratable sin NIT? | | |
| 11 | FRR medido | | |
| 12 | Latencia p95 medida | | |
| 13 | ¿Resiste foto en pantalla? | | |
| 14 | ¿Resiste video replay? | | |
| 15 | ¿Detección de inyección de cámara? | | |

Cuando esta tabla esté llena, se escribe **ADR-006** en [07-decisiones-adr.md](07-decisiones-adr.md)
y se cierra la decisión.
