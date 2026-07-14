import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rateLimit.js";

const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg"
]);

type DetectedMedia = {
  kind: "image" | "video";
  extension: "jpg" | "png" | "webp" | "gif" | "mp4" | "mov" | "webm" | "ogg";
};

function detectMedia(header: Buffer): DetectedMedia | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { kind: "image", extension: "jpg" };
  }
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: "image", extension: "png" };
  }
  if (header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP") {
    return { kind: "image", extension: "webp" };
  }
  const gifHeader = header.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return { kind: "image", extension: "gif" };
  }
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { kind: "video", extension: "webm" };
  }
  if (header.subarray(0, 4).toString("ascii") === "OggS") {
    return { kind: "video", extension: "ogg" };
  }
  if (header.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = header.subarray(8, 12).toString("ascii");
    return { kind: "video", extension: brand === "qt  " ? "mov" : "mp4" };
  }
  return null;
}

async function readHeader(filePath: string) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function removeFile(filePath?: string) {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => undefined);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`)
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!acceptedMimeTypes.has(file.mimetype.toLowerCase())) {
      return cb(new Error("Unsupported media type"));
    }
    cb(null, true);
  }
});

const router = Router();

const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  key: (req) => req.user?.id || req.ip || "unknown",
  message: "Upload limit reached. Please try again later."
});

router.post("/", requireAuth, uploadRateLimit, (req, res, next) => {
  upload.single("file")(req, res, async (uploadError) => {
    const uploadedFile = req.file;
    if (uploadError) {
      await removeFile(uploadedFile?.path);
      if (uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "Video files must be under 100MB" });
      }
      return res.status(400).json({ message: uploadError.message || "Upload failed" });
    }
    if (!uploadedFile) return res.status(400).json({ message: "A media file is required" });

    try {
      const detected = detectMedia(await readHeader(uploadedFile.path));
      if (!detected) {
        await removeFile(uploadedFile.path);
        return res.status(400).json({ message: "The file content is not a supported image or video" });
      }
      if (detected.kind === "image" && uploadedFile.size > MAX_IMAGE_SIZE) {
        await removeFile(uploadedFile.path);
        return res.status(413).json({ message: "Image files must be under 5MB" });
      }

      const finalName = `${path.parse(uploadedFile.filename).name}.${detected.extension}`;
      const finalPath = path.join(uploadDir, finalName);
      await fs.promises.rename(uploadedFile.path, finalPath);
      const url = `/uploads/${finalName}`;
      return res.status(201).json({ urls: [url], url });
    } catch (error) {
      await removeFile(uploadedFile.path);
      return next(error);
    }
  });
});

export default router;
