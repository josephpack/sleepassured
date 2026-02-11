import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      userId: req.user?.userId,
    },
    "Unhandled error"
  );

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    error: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
}
