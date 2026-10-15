import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { notFoundHandler, globalErrorHandler } from "./middlewares/errorHandler";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.headers["x-request-id"];
      const id = Array.isArray(existing) ? existing[0] : existing;
      const requestId = id ?? crypto.randomUUID();
      res.setHeader("x-request-id", requestId);
      return requestId;
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url?.split("?")[0]} completed with ${res.statusCode}`,
    customErrorMessage: (req, res) =>
      `${req.method} ${req.url?.split("?")[0]} failed with ${res.statusCode}`,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}

app.use("/api", router);

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
