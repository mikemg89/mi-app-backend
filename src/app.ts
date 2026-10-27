// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// 1. Seguridad HTTP (cabeceras)
app.use(helmet());

// 2. CORS (Permitir que tu app React Native consuma la API)
app.use(
  cors({
    origin: "*", // En producción, aquí deberías poner el dominio de tu app
  }),
);

// 3. Body parser con límite de tamaño (evita ataques de payload gigante)
app.use(express.json({ limit: "10kb" }));

// 4. Rate Limiting Global (evita fuerza bruta y DDoS básico)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por IP cada 15 min
  message: "Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.",
});
app.use(limiter);

// 5. Ruta de salud (para verificar que el servidor está vivo)
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "ok", message: "Servidor funcionando correctamente" });
});

// Aquí irán nuestras rutas de autenticación y perfiles en el futuro
// app.use('/api/auth', authRoutes);

export default app;
