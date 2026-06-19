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

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/listings", listingRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}
