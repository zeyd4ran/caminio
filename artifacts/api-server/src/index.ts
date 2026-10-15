import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    logger.error({ port, err }, `Port ${port} is in use. Trying alternate port...`);
    const alternatePort = port + 1;
    app.listen(alternatePort, () => {
      logger.info({ port: alternatePort }, `Server listening on alternate port`);
    });
  } else {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
});
