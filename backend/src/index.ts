import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { markReady, markShuttingDown } from "./health.js";
import { prisma } from "./prisma.js";
import { attachSocket } from "./socket.js";

try {
  await prisma.$connect();
} catch {
  console.error(JSON.stringify({ level: "error", event: "database_startup_failed", at: new Date().toISOString() }));
  process.exit(1);
}
markReady();

const app = createApp();
const server = http.createServer(app);
const io = attachSocket(server);

server.listen(env.PORT, env.HOST, () => {
  console.log(JSON.stringify({ level: "info", event: "api_started", host: env.HOST, port: env.PORT, at: new Date().toISOString() }));
});

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  markShuttingDown();
  console.log(JSON.stringify({ level: "info", event: "api_shutdown", signal, at: new Date().toISOString() }));

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  // Socket.IO's close() also closes the underlying HTTP server. Disconnect
  // clients explicitly and let the HTTP server drain in-flight requests once.
  io.disconnectSockets(true);
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    clearTimeout(forceExit);
    process.exit(exitCode);
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("uncaughtException", (error) => {
  console.error(JSON.stringify({ level: "error", event: "uncaught_exception", errorType: error.name, at: new Date().toISOString() }));
  void shutdown("uncaughtException", 1);
});
process.once("unhandledRejection", (reason) => {
  console.error(JSON.stringify({ level: "error", event: "unhandled_rejection", errorType: reason instanceof Error ? reason.name : "UnknownError", at: new Date().toISOString() }));
  void shutdown("unhandledRejection", 1);
});
