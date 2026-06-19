import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images are allowed"));
    cb(null, true);
  }
});

const router = Router();

router.post("/", requireAuth, upload.array("images", 6), (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  res.status(201).json({
    urls: files.map((file) => `/uploads/${file.filename}`)
  });
});

export default router;
