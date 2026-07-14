import path from "node:path";
import "express-async-errors";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./env.js";
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
import { registerSwagger } from "./swagger.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), {
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    }
  }));
  registerSwagger(app);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
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

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}
