// src/utils/asyncHandler.ts
import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

type AsyncRoute = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Envuelve controladores async para que cualquier promesa rechazada llegue
 * al middleware central de errores en lugar de tumbar el proceso.
 */
export const asyncHandler = (handler: AsyncRoute): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
