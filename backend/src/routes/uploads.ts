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
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images are allowed"));
    cb(null, true);
  }
});

const router = Router();

router.post("/", requireAuth, upload.any(), (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  if (files.length > 6) return res.status(400).json({ message: "Maximum of 6 images allowed" });
  const urls = files.map((file) => `/uploads/${file.filename}`);
  res.status(201).json({
    urls,
    url: urls[0]
  });
});

export default router;
