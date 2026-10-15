import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { AppError, sendError, sendValidationError } from "../lib/apiErrors";

function isZodError(err: unknown): err is { issues: Parameters<typeof sendValidationError>[2]["issues"] } & Parameters<typeof sendValidationError>[2] {
  return Boolean(
    err &&
      typeof err === "object" &&
      "issues" in err &&
      Array.isArray((err as { issues?: unknown }).issues),
  );
}

export const notFoundHandler = (req: Request, res: Response): void => {
  req.log.warn({ method: req.method, path: req.path }, "Route not found");
  sendError(req, res, 404, "ROUTE_NOT_FOUND", `Route ${req.method} ${req.path} not found`);
};

export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof SyntaxError && "body" in err) {
    req.log.warn({ err }, "Malformed JSON in request body");
    sendError(req, res, 400, "INVALID_JSON", "Invalid JSON in request body");
    return;
  }

  if (isZodError(err)) {
    req.log.warn({ issues: err.issues }, "Response validation failed");
    sendValidationError(req, res, err);
    return;
  }

  if (err instanceof AppError) {
    req.log.warn(
      { code: err.code, statusCode: err.statusCode, details: err.details },
      "Handled API error",
    );
    sendError(req, res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  const stack = err instanceof Error ? err.stack : undefined;

  req.log.error(
    { err: { message, stack }, method: req.method, path: req.path },
    "Unhandled server error"
  );

  sendError(req, res, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
};
