// src/utils/password.ts
import argon2 from "argon2";

/**
 * Hashea una contraseña usando Argon2id.
 * Es lento a propósito para evitar ataques de fuerza bruta.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3, // 3 iteraciones
    parallelism: 1,
  });
};

/**
 * Verifica si una contraseña en texto plano coincide con el hash guardado.
 */
export const verifyPassword = async (
  hash: string,
  plain: string,
): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch (error) {
    return false;
  }
};
