import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";

const VIDEO_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR, "videos");

export type VideoKind = "mp4" | "webm";

/**
 * Verifica los bytes mágicos del archivo. Confiar solo en el Content-Type
 * permitiría subir cualquier cosa con la cabecera correcta.
 */
export function detectVideoKind(buffer: Buffer): VideoKind | null {
  if (buffer.length > 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return "mp4"; // MP4 / MOV
  }

  if (
    buffer.length > 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "webm"; // WebM / Matroska
  }

  return null;
}

export async function saveVideo(
  userId: string,
  verificationId: string,
  buffer: Buffer,
  kind: VideoKind,
): Promise<{ storagePath: string; sizeBytes: number }> {
  const dir = path.join(VIDEO_ROOT, userId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${verificationId}.${kind}`);
  await fs.writeFile(filePath, buffer, { mode: 0o600 });

  return {
    storagePath: path.relative(process.cwd(), filePath),
    sizeBytes: buffer.length,
  };
}

export async function deleteVideo(storagePath?: string | null): Promise<void> {
  if (!storagePath) {
    return;
  }

  try {
    await fs.unlink(path.resolve(process.cwd(), storagePath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error("No se pudo borrar el video:", error);
    }
  }
}

/** Borra los archivos con más de `maxAgeDays` días. Se ejecuta al arrancar. */
export async function purgeOldVideos(maxAgeDays = 7): Promise<number> {
  const limit = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // el directorio aún no existe
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }

      try {
        const stat = await fs.stat(full);
        if (stat.mtimeMs < limit) {
          await fs.unlink(full);
          removed += 1;
        }
      } catch {
        // archivo en uso o ya borrado: se ignora
      }
    }
  }

  await walk(VIDEO_ROOT);
  return removed;
}
