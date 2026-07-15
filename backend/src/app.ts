import path from "node:path";
import "express-async-errors";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { allowedClientOrigins, env } from "./env.js";
import authRoutes from "./routes/auth.js";
import listingRoutes from "./routes/listings.js";
import uploadRoutes from "./routes/uploads.js";
import favoriteRoutes from "./routes/favorites.js";
import conversationRoutes from "./routes/conversations.js";
import reportRoutes from "./routes/reports.js";
import adminRoutes from "./routes/admin.js";
import transactionRoutes from "./routes/transactions.js";
import announcementRoutes from "./routes/announcements.js";
import communityRoutes from "./routes/community.js";
import wantAdRoutes from "./routes/wantAds.js";
import supportRoutes from "./routes/support.js";
import telemetryRoutes from "./routes/telemetry.js";
import { registerSwagger } from "./swagger.js";
import { checkReadiness, getLifecycleState } from "./health.js";
import { errorHandler, requestContext } from "./middleware/requestContext.js";
import { originProtection } from "./middleware/originProtection.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");
  app.use(requestContext);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use(cors({
    origin: allowedClientOrigins,
    credentials: true,
    exposedHeaders: ["X-Request-ID", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"]
  }));
  app.use(originProtection);
  app.use(express.json({ limit: "1mb" }));
  if (env.NODE_ENV !== "production") app.use(morgan("dev"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), {
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    }
  }));
  registerSwagger(app);

  app.get("/api/health/live", (_req, res) => res.json({ ok: true, state: getLifecycleState(), version: env.APP_VERSION }));
  const readinessHandler: express.RequestHandler = async (_req, res) => {
    const readiness = await checkReadiness();
    res.status(readiness.ready ? 200 : 503).json({ ok: readiness.ready, ...readiness, version: env.APP_VERSION });
  };
  app.get("/api/health/ready", readinessHandler);
  app.get("/api/ready", readinessHandler);
  app.get("/api/health", readinessHandler);
  app.use("/api/auth", authRoutes);
  app.use("/api/listings", listingRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/community", communityRoutes);
  app.use("/api/want-ads", wantAdRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/telemetry", telemetryRoutes);

  app.use(errorHandler);

  return app;
}
