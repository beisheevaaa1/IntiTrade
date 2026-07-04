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
  limits: { fileSize: 100 * 1024 * 1024, files: 25 },
  fileFilter: (_req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    if (!isImage && !isVideo) {
      return cb(new Error("Only images and videos are allowed"));
    }
    cb(null, true);
  }
});

const router = Router();

router.post("/", requireAuth, upload.any(), (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  
  for (const file of files) {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    
    if (isImage && file.size > 5 * 1024 * 1024) {
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(400).json({ message: "Image files must be less than 5MB" });
    }
    
    if (isVideo && file.size > 100 * 1024 * 1024) {
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(400).json({ message: "Video files must be less than 100MB" });
    }
  }

  const urls = files.map((file) => `/uploads/${file.filename}`);
  res.status(201).json({
    urls,
    url: urls[0]
  });
});

export default router;
