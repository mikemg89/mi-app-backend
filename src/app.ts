import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

const app = express();

// 1. Seguridad HTTP (cabeceras)
app.use(helmet());

// 2. Confianza en proxy (necesario para rate limiting detrás de Render/Heroku/Nginx)
if (env.TRUST_PROXY) {
  if (env.TRUST_PROXY === "true") {
    app.set("trust proxy", true);
  } else if (env.TRUST_PROXY === "false") {
    app.set("trust proxy", false);
  } else if (/^\d+$/.test(env.TRUST_PROXY)) {
    app.set("trust proxy", Number(env.TRUST_PROXY));
  } else {
    app.set("trust proxy", env.TRUST_PROXY);
  }
}

// 3. CORS (por defecto abierto; en producción define CORS_ORIGINS)
const allowedOrigins = env.CORS_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin =
  !allowedOrigins?.length || allowedOrigins.includes("*")
    ? "*"
    : allowedOrigins;

if (env.NODE_ENV === "production" && corsOrigin === "*") {
  console.warn(
    "CORS_ORIGINS no está definido; se está permitiendo cualquier origen.",
  );
}

app.use(cors({ origin: corsOrigin }));

// 4. Body parser con límite de tamaño (evita ataques de payload gigante)
app.use(express.json({ limit: "10kb" }));

// 5. Rate limiting para la API (evita fuerza bruta y DDoS básico)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 100, // 100 peticiones por IP cada 15 min
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.",
});
app.use("/api", limiter);

// 6. Salud del proceso (liveness)
app.get("/health", (_req, res) => {
  res
    .status(200)
    .json({ status: "ok", message: "Servidor funcionando correctamente" });
});

// 7. Disponibilidad de la base de datos (readiness)
app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "up" });
  } catch (error) {
    console.error("La comprobación de base de datos falló:", error);
    res.status(503).json({ status: "error", db: "down" });
  }
});

// Aquí irán nuestras rutas de autenticación y perfiles en el futuro
// app.use('/api/auth', authRoutes);

// 8. Ruta no encontrada
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// 9. Manejo centralizado de errores
app.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "JSON inválido" });
      return;
    }

    const status =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status: unknown }).status)
        : Number.NaN;

    if (status === 413) {
      res.status(413).json({ error: "Payload demasiado grande" });
      return;
    }

    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  },
);

export default app;
