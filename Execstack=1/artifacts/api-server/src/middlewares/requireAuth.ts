import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { sendError } from "../lib/apiErrors";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = process.env.CLERK_SECRET_KEY ? getAuth(req) : undefined;
  const testHeader = req.header("x-test-user-id");
  const testUserId =
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    typeof testHeader === "string" &&
    testHeader.trim().length > 0
      ? testHeader.trim()
      : undefined;
  const userId = auth?.userId ?? testUserId;

  if (!userId) {
    req.log.warn(
      { method: req.method, path: req.path, ip: req.ip },
      "Auth failure: missing or invalid token"
    );
    sendError(req, res, 401, "UNAUTHORIZED", "Authentication is required");
    return;
  }

  (req as Request & { userId: string }).userId = userId;
  next();
}
