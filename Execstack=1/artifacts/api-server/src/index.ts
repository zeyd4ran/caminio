import { logger } from "./lib/logger";
import { assertProductionConfig } from "./lib/config";

assertProductionConfig(process.env);

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const { default: app } = await import("./app");

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
