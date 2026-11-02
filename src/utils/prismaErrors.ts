// src/utils/prismaErrors.ts

const UNIQUE_CONSTRAINT_ERROR = "P2002";

/**
 * Comprueba si un error es una violación de restricción UNIQUE de Prisma.
 * Se usa una comprobación estructural para no depender de la ruta interna
 * del cliente generado.
 */
export const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_ERROR
  );
};

/**
 * Devuelve el campo o campos que provocaron la violación UNIQUE.
 * Prisma puede exponer `meta.target` como string o como array.
 */
export const uniqueConstraintTarget = (error: unknown): string | undefined => {
  if (!isUniqueConstraintError(error)) {
    return undefined;
  }

  const target = (error as { meta?: { target?: unknown } }).meta?.target;

  if (Array.isArray(target)) {
    return target.join(",");
  }

  return typeof target === "string" ? target : undefined;
};
