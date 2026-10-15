import type { Request, Response } from "express";
import type { ZodError } from "zod";

export type ErrorDetails = unknown;

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: ErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function requestId(req: Request): string {
  return typeof req.id === "string" ? req.id : String(req.id ?? "unknown");
}

export function errorBody(req: Request, code: string, message: string, details?: ErrorDetails) {
  return {
    error: {
      code,
      message,
      requestId: requestId(req),
      ...(details == null ? {} : { details }),
    },
  };
}

export function sendError(
  req: Request,
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ErrorDetails,
): void {
  res.status(statusCode).json(errorBody(req, code, message, details));
}

export function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function sendValidationError(req: Request, res: Response, error: ZodError): void {
  sendError(req, res, 400, "VALIDATION_ERROR", "Request validation failed", zodDetails(error));
}