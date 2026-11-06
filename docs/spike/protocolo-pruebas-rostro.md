# Protocolo de pruebas — verificación facial

**Para usar en:** Fase 0 (spike), días 3 y 4. · **Duración:** 2 días por proveedor.
**Documento de trabajo:** [matriz-proveedores.xlsx](matriz-proveedores.xlsx) → hoja `Protocolo`.

---

## 1. Qué se mide (y por qué esas cosas)

Un proveedor de identidad se vende con demos de escritorio con luz perfecta. Lo que decide si sirve
para una app de citas en Colombia son cinco números:

| Métrica | Definición | Por qué importa |
|---|---|---|
| **FRR** (falso rechazo) | Personas reales que no logran verificarse en 3 intentos | Cada punto de FRR es un usuario perdido y un ticket de soporte |
| **FAR** (falsa aceptación) | Ataques que pasan | Es la promesa del producto: si un video pasa, no hay producto |
| **Latencia p95** | Tiempo total del flujo (captura + red + resultado) | Por encima de ~15 s la gente abandona |
| **Reintentos** | Media de intentos hasta el éxito | Multiplica el costo por verificación |
| **Abandono** | Personas que empiezan y no terminan | El número más honesto sobre la UX |

**Regla:** si un proveedor no supera **FRR ≤ 5 %** y **FAR ≤ 5 %** en esta muestra, no pasa — por
buena que sea su demo.

---

## 2. Muestra

| Requisito | Valor |
|---|---|
| Personas | **20–30** (mínimo 15 para que el FRR tenga sentido) |
| Composición | Al menos 40 % de piel oscura o media; edades 20–55; ambos géneros |
| Dispositivos | Al menos 5 referencias distintas, incluido **un Android de gama baja o media** |
| Condiciones | Cada persona prueba en 2 condiciones de luz (buena y baja) |
| Documentos | Al menos 1 cédula amarilla, 1 cédula digital, 1 PPT, 1 pasaporte |

> Si en la muestra no hay PPT y el producto lo va a exigir, el spike **no está completo**.

### Consentimiento de los participantes (obligatorio)

Aunque sea una prueba, estás recolectando datos biométricos. Texto mínimo que cada persona firma:

> "Autorizo el uso de mi imagen y documento únicamente para probar el sistema de verificación de
> [proyecto] el [fecha]. Entiendo que las capturas se eliminan al terminar la prueba y que puedo
> retirarme en cualquier momento sin dar explicaciones."

Y al terminar: **borrar las capturas** y registrar que se borraron.

---

## 3. Escenarios

### 3.1 Casos legítimos (deben PASAR)

| ID | Escenario | Qué evalúa |
|---|---|---|
| G1 | Luz natural, fondo neutro | El caso ideal (baseline) |
| G2 | Luz baja (interior de noche, una lámpara) | El caso real más común |
| G3 | A contraluz (ventana detrás) | Exposición |
| G4 | Con gafas | Accesorios |
| G5 | Sin gafas, con barba recién cortada vs. foto del documento con barba | Cambio de apariencia |
| G6 | Maquillaje marcado | Tolerancia |
| G7 | Cámara frontal de gama baja (720p, ruido) | Hardware pobre |
| G8 | Persona de piel oscura con luz baja | **Sesgo: el fallo más frecuente de estos sistemas** |

### 3.2 Casos de ataque (deben FALLAR)

| ID | Ataque | Nivel de dificultad | Qué evalúa |
|---|---|---|---|
| A1 | Foto impresa en papel, sostenida frente a la cámara | Bajo | Anti-spoofing básico |
| A2 | Foto a color mostrada en **otro teléfono** (pantalla) | Medio | Detección de pantalla / moiré |
| A3 | **Video** de la persona reproduciéndose en otro teléfono | Medio-alto | Replay |
| A4 | Video con movimiento de cabeza pregrabado | Alto | Reto activo |
| A5 | Máscara impresa 3D o foto recortada con ojos | Alto | Profundidad |
| A6 | **Cámara virtual / inyección** (Android: app que sustituye la cámara) | **Muy alto** | Detección de inyección |
| A7 | Gemelo / persona parecida | Medio | 1:1 con umbral |
| A8 | Foto de la persona en la pantalla de una laptop, a 50 cm | Medio | Distancia y tamaño |

> **A3, A4 y A6 son los que separan un SDK de verdad de uno que solo detecta "hay una cara".**
> Si el proveedor pasa A1 y A2 pero cae en A3 o A6, no sirve para este producto.

Cada ataque se repite **3 veces** (por si acierta por azar).

---

## 4. Cómo se registra

Hoja `Protocolo` del Excel. Una fila por intento:

| Campo | Valores |
|---|---|
| `participante` | P01…P30 (seudónimo, nunca el nombre real) |
| `caso` | G1…G8, A1…A8 |
| `dispositivo` | Modelo |
| `luz` | buena / baja / contraluz |
| `resultado` | PASS / FAIL / REVIEW / ERROR |
| `latencia_ms` | Medida con cronómetro o `performance.now()` |
| `intentos` | 1, 2, 3 |
| `nota` | Cualquier anomalía ("pidió acercarse", "se quedó en bucle") |

---

## 5. Cálculo

```
FRR = intentos que terminan en FAIL tras 3 intentos, en casos G*   / total de casos G*
FAR = ataques que terminan en PASS, en casos A*                    / total de casos A*
```

Con 20 personas × 8 casos legítimos y 8 ataques × 3 repeticiones, la muestra da una señal
suficiente para descartar un proveedor. **No da significancia estadística** — no es un paper, es
una decisión de negocio.

### Umbrales de aceptación

| Métrica | Aceptable | Excelente |
|---|---|---|
| FRR global | ≤ 8 % | ≤ 3 % |
| FRR en G8 (piel oscura, luz baja) | ≤ 15 % | ≤ 8 % |
| FAR en A1–A2 | 0 % | 0 % |
| FAR en A3–A4 (replay) | ≤ 5 % | 0 % |
| FAR en A6 (inyección) | Debe **detectarlo como ataque**, no como error | — |
| Latencia p95 | ≤ 15 s | ≤ 9 s |
| Reintentos medios | ≤ 2.0 | ≤ 1.5 |

---

## 6. Guion de la sesión con cada participante (15 min)

1. **2 min** — Explicar, firmar consentimiento, asignar código (P01).
2. **3 min** — Registro bueno (G1). Cronometrar. Anotar si el SDK guía bien.
3. **3 min** — Casos de luz (G2, G3) y accesorios (G4).
4. **3 min** — Documento: captura de su cédula/PPT. Anotar si el OCR lee bien y si hay que
   reintentar.
5. **4 min** — Ataques de A1, A2, A3, A8 (los que se puedan hacer con el material impreso y el
   segundo teléfono).
6. **Cierre** — Preguntar: *"¿Confiarías en esta app para verificar a alguien?"* y anotar la
   respuesta textual. Es la métrica cualitativa que ninguna tabla captura.

### Materiales que hay que llevar

- 4 fotos impresas de la cara del participante (una por caso A1).
- Un segundo teléfono con el video de la persona (grabar en el momento: 10 s moviendo la cabeza).
- Un portátil para A8.
- Cédulas y PPT reales de los participantes (con su autorización).
- Cinta métrica o marcador en el piso para distancias (30 / 50 cm).

---

## 7. Después de la prueba

- [ ] Llenar la matriz (hoja `Matriz`) con los 9 criterios.
- [ ] Calcular costo real usando la tasa de reintento medida, no 1.0 (hoja `Costos`).
- [ ] Escribir ADR-006 con la decisión y el porqué.
- [ ] Borrar todas las capturas y registrar el borrado.
- [ ] Comunicar el resultado a los participantes que lo pidan.

---

## 8. Errores que invalidan el spike

| Error | Consecuencia |
|---|---|
| Probar solo con colegas de 25 años y buena luz | FRR irreal; el lanzamiento sorprende |
| No probar PPT | Se descubre en producción, con usuarios reales rechazados |
| Medir con el proveedor en su región de origen | Latencia irreal desde Colombia |
| No probar ataque de video | Es el ataque más común y el más fácil de ejecutar |
| Decidir por precio sin mirar FAR | El producto promete seguridad y entrega una foto |
| No firmar consentimiento | Riesgo legal en una prueba que ya maneja biometría |
