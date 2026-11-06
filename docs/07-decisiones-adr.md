# 07 · Registro de decisiones (ADR)

Formato ligero: **contexto → decisión → consecuencias**. Una decisión cerrada no se reabre sin
escribir un ADR nuevo que la reemplace (y marcarlo aquí como *sustituido por*).

| ID | Decisión | Estado | Fecha |
|---|---|---|---|
| ADR-001 | Rostro en login con credenciales y dispositivo nuevo, no en cada apertura | ✅ Aceptada | 2026-11-05 |
| ADR-002 | Verificación obligatoria para todos los usuarios | ✅ Aceptada | 2026-11-05 |
| ADR-003 | Verificación de documento en el registro (CC, CE, PPT, pasaporte) | ⏸ **Diferida** (ADR-009) | 2026-11-05 |
| ADR-004 | Búsqueda 1:N habilitada en el alta | ⏸ **Diferida** (ADR-009) | 2026-11-05 |
| ADR-005 | Ubicación difusa; nunca coordenadas exactas | ✅ Aceptada | 2026-11-05 |
| ADR-006 | Proveedor de identidad | ⏳ Pendiente (spike) | — |
| ADR-007 | Access token en memoria + refresh en SecureStore | ✅ Aceptada | 2026-11-05 |
| ADR-008 | Documentación transversal vive fuera de los dos repos | 🔁 Sustituida por ADR-010 | 2026-11-05 |
| ADR-009 | MVP sin proveedor: video-selfie + invitación + revisión manual (difiere 003 y 004) | ✅ Aceptada | 2026-11-05 |
| ADR-010 | La documentación vive en `mi-app-backend/docs/` y la app enlaza por URL | ✅ Aceptada | 2026-11-06 |

---

## ADR-001 · Cuándo se pide el rostro

**Contexto.** El requisito inicial era "autenticación facial en cada inicio de sesión". Tomado al
pie de la letra, cada apertura de la app exige cámara, luz y 5–15 segundos. Los bancos no lo hacen.

**Decisión.** El rostro se exige en:
1. Login con credenciales.
2. Dispositivo nuevo o no confiable.
3. Acciones sensibles (step-up con `auth_time` < 5 min).
4. Tras N días de inactividad.

La sesión se mantiene con refresh rotativo de 30 días deslizante.

**Consecuencias.**
- ✅ La app se puede usar a diario sin fricción.
- ✅ "Cada inicio de sesión" se cumple literalmente: cada vez que se ingresan credenciales.
- ⚠️ Un teléfono desbloqueado con sesión viva no pide rostro. Mitigado con PIN biométrico local
  (opcional) y con step-up en lo sensible.
- ⚠️ Requiere implementar rotación de refresh y detección de reuso (Fase 1).

---

## ADR-002 · Verificación obligatoria

**Contexto.** Se evaluó un modo "solo mirar" indefinido, que mejora el embudo.

**Decisión.** No hay modo permanente sin verificar. Se puede **ver** en L0 (fotos desenfocadas, sin
distancia, sin bio), pero **aparecer en el mazo y cualquier interacción exigen L2 + L3 + L4**.

**Consecuencias.**
- ✅ La promesa del producto se sostiene: no hay perfiles sin verificar en circulación.
- ⚠️ Se asume una caída de embudo del 30–50 % en la puerta del KYC.
- ⚠️ Obliga a tener buen manejo de errores de cámara: ahí se pierden usuarios.

---

## ADR-003 · Documento en el registro

**Estado:** ⏸ **diferida por [ADR-009](#adr-009--mvp-sin-proveedor-de-identidad).** Se implementa al
pasar los umbrales de escala (300–500 usuarios o ingresos que paguen ~USD 1 por verificación).

**Contexto.** Verificar solo el rostro contra una plantilla propia demuestra que "alguien" es
consistente, no que sea quien dice ser. Sin documento no hay identidad, solo continuidad.

**Decisión.** En el registro se captura documento (cédula amarilla, cédula digital, CE, PPT o
pasaporte) + selfie con prueba de vida, y se coteja la cara del documento contra la selfie.

**Consecuencias.**
- ✅ Se obtiene la fecha de nacimiento real → verificación de edad sin autodeclaración.
- ✅ Se obtiene nombre y número (hasheado) para deduplicación secundaria.
- ⚠️ Depende de que el proveedor cubra PPT; si no, hay que resolverlo antes de lanzar.
- ⚠️ La imagen del documento es el dato más sensible del sistema: 30 días de retención máxima.

---

## ADR-004 · Búsqueda 1:N

**Estado:** ⏸ **diferida por [ADR-009](#adr-009--mvp-sin-proveedor-de-identidad).** Sin biometría no
hay 1:N. La multicuenta se controla con invitación + revisión manual + hash de email/teléfono.

**Contexto.** El catfishing escalado se hace con cuentas múltiples. Sin 1:N, un usuario expulsado
vuelve con otro email.

**Decisión.** Se ejecuta 1:N en el enrolamiento. Si hay coincidencia, la respuesta al cliente es
`409 IDENTITY_REVIEW` genérica y se abre un caso de revisión humana.

**Consecuencias.**
- ✅ Impide multicuenta por cara y permite lista de bloqueo.
- ✅ El mensaje neutro evita convertir el 1:N en un oráculo de identidades.
- ⚠️ Convierte el sistema en una **base biométrica centralizada**, justo lo que la SIC mira con
  lupa: exige propósito único, cifrado, auditoría, PIA y plazo de retención.
- ⚠️ Costo por búsqueda en algunos proveedores.

---

## ADR-005 · Ubicación difusa

**Contexto.** La distancia es funcionalidad central en una app de citas. La coordenada exacta es
también el insumo del stalking.

**Decisión.** Se guarda **solo geohash truncado a 5** (~5 km) y la ciudad. La API expone buckets
(`< 2 km`, `2–5`, `5–10`, `+10`). Ninguna respuesta contiene lat/lng.

**Consecuencias.**
- ✅ Elimina el vector de geolocalización precisa.
- ⚠️ La distancia es aproximada; hay que comunicarlo ("aproximadamente a 3 km").
- ⚠️ La única excepción es la cita segura, y solo para los contactos de confianza del propio
  usuario, con TTL.

---

## ADR-006 · Proveedor de identidad

**Estado:** ⏳ **pendiente del spike.**

**Contexto.** Cinco familias evaluadas: Didit, Truora, AWS Rekognition, FaceTec, stack abierto.
Restricciones: proyecto personal sin empresa, Colombia (PPT), Expo/RN, datos sensibles.

**Decisión provisional.** Proveedor hospedado y autoservicio para documento + liveness, validado
con el protocolo de pruebas. Plan B: Truora por cobertura. Plan C: FaceTec si el liveness del
hospedado falla.

**Se cierra cuando** la tabla §8 de [03-spike-kyc.md](03-spike-kyc.md) esté completa.

**Consecuencias de la decisión (cualquiera sea).**
- ⚠️ Las plantillas son propietarias: cambiar de proveedor obliga a **re-enrolar a todos**. La
  elección es casi irreversible.
- ✅ Mitigado parcialmente por el puerto `IdentityProvider`.

---

## ADR-007 · Dónde viven los tokens

**Contexto.** Ya implementado en el repo de la app.

**Decisión.** Access token en **memoria** (nunca en disco), refresh token en **SecureStore**
(Keychain / Keystore) con `WHEN_UNLOCKED`.

**Consecuencias.**
- ✅ Un volcado del almacenamiento no expone el access token.
- ⚠️ Cada arranque en frío exige un refresh antes de la primera llamada: hay que resolverlo en el
  arranque (splash → refresh silencioso), no con un 401 reactivo.
- ⚠️ `WHEN_UNLOCKED` no impide el acceso en un dispositivo rooteado; la atestación (L5) es la capa
  que sí ayuda.

---

## ADR-008 · Dónde vive la documentación

**Contexto.** El proyecto son dos repos independientes. La arquitectura es transversal.

**Decisión.** La documentación vive en `DateApp/docs/`, fuera de ambos repos, hasta que se unifiquen
en un monorepo.

**Consecuencias.**
- ✅ Una sola fuente de verdad para ambos lados.
- ⚠️ No está versionada. **Pendiente:** mover a un repo `dateapp-docs` o al monorepo cuando exista.
- ⚠️ Riesgo de que se desactualice sin que nadie lo note: cada cambio de contrato debe tocar el
  doc 02 en el mismo commit.

---

## ADR-009 · MVP sin proveedor de identidad

**Estado:** ✅ Aceptada · **Sustituye parcialmente:** ADR-003 y ADR-004.

**Contexto.** El diseño anterior (documento + prueba de vida certificada + 1:N + login facial con
un proveedor de KYC) es correcto para una empresa, no para una persona que desarrolla sola y sin
presupuesto. El costo por verificación, la operación del proveedor y las obligaciones legales de una
base biométrica superan, hoy, el valor que aportan a 50–200 usuarios.

**Decisión.** El MVP verifica así:

1. **Registro solo por invitación.** Sin código válido no hay cuenta.
2. **OTP por email** para activar la cuenta (gratis con Resend/Brevo).
3. **Video-selfie de 5 s diciendo un código aleatorio** + giro de cabeza. Prueba de vida sin costo:
   una foto robada no pasa, un video pregrabado tampoco.
4. **Revisión humana** (tú, con un bot de Telegram). Ningún perfil se publica sin aprobación.
5. **Insignia honesta:** "Video verificado · fecha". Nunca "identidad verificada".

**Consecuencias.**
- ✅ Costo $0, sin dependencias, sin base biométrica, sin DPA.
- ✅ Protección alta para la escala real del proyecto.
- ⚠️ No escala: la revisión manual se vuelve el cuello de botella a partir de ~200 altas/mes.
- ⚠️ No detecta a alguien que paga por un video real (suplantación por encargo). Aceptable: es un
  ataque caro y poco frecuente.
- 🔁 **Se reevalúa** al llegar a 300–500 usuarios, cuando la revisión pase de 30 min/día o cuando
  aparezca evasión de bans.
- ✅ La interfaz `IdentityProvider` del doc 02 se mantiene como camino de migración: cuando vuelva
  el KYC, se enchufa un adaptador sin reescribir el flujo.

**Documento rector del MVP:** [00-mvp-sin-presupuesto.md](00-mvp-sin-presupuesto.md).

---

## ADR-010 · La documentación vive en el repo del backend

**Estado:** ✅ Aceptada · **Sustituye a:** ADR-008.

**Contexto.** La documentación estaba en `DateApp/docs/`, una carpeta entre los dos repos que no
pertenecía a ninguno. Consecuencia: no estaba versionada y el primer `git push` la dejó fuera. Ante
un cambio de equipo o un fallo del disco, se perdía por completo.

**Decisión.** La documentación se mueve a **`mi-app-backend/docs/`** y se versiona con el backend.
El README de la app enlaza por URL absoluta a GitHub, porque un enlace relativo entre repositorios
se rompe al clonar uno solo.

**Consecuencias.**
- ✅ La documentación viaja con el repositorio: se respalda, se revisa en PR y tiene historial.
- ✅ Un solo lugar de verdad para arquitectura y decisiones.
- ⚠️ Quien clone solo la app no verá los documentos en disco; tendrá que abrir el enlace.
- ⚠️ Actualizar un documento es ahora un commit en el repo del backend: hay que hacerlo junto con
  el cambio de contrato, no después.
- 🔁 Si el proyecto pasa a monorepo, la carpeta se mueve tal cual y este ADR se sustituye.
