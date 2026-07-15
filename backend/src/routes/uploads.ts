import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { env } from "../env.js";
import { prisma } from "../prisma.js";

const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = env.UPLOAD_MAX_VIDEO_MB * 1024 * 1024;
const MAX_USER_UPLOAD_BYTES = env.UPLOAD_MAX_USER_MB * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = env.UPLOAD_MAX_TOTAL_MB * 1024 * 1024;

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

async function uploadUsage(userId: string) {
  let totalBytes = 0;
  let userBytes = 0;
  const entries = await fs.promises.readdir(uploadDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const stat = await fs.promises.stat(path.join(uploadDir, entry.name));
    totalBytes += stat.size;
    if (entry.name.startsWith(`${userId}-`)) userBytes += stat.size;
  }
  return { totalBytes, userBytes };
}

export function uploadQuotaExceeded(usage: { totalBytes: number; userBytes: number }) {
  return usage.totalBytes > MAX_TOTAL_UPLOAD_BYTES || usage.userBytes > MAX_USER_UPLOAD_BYTES;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, _file, cb) => cb(null, `${req.user!.id}-${crypto.randomUUID()}.upload`)
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

const uploadIpRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: "Upload limit reached for this network. Please try again later."
});

router.post("/", requireAuth, uploadIpRateLimit, uploadRateLimit, (req, res, next) => {
  upload.single("file")(req, res, async (uploadError) => {
    const uploadedFile = req.file;
    if (uploadError) {
      await removeFile(uploadedFile?.path);
      if (uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: `Video files must be under ${env.UPLOAD_MAX_VIDEO_MB}MB` });
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

      const usage = await uploadUsage(req.user!.id);
      if (uploadQuotaExceeded(usage)) {
        await removeFile(uploadedFile.path);
        return res.status(413).json({ message: "Upload storage quota reached. Remove unused media or contact support." });
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

router.delete("/:filename", requireAuth, uploadRateLimit, async (req, res) => {
  const filename = req.params.filename;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || !filename.startsWith(`${req.user!.id}-`)) {
    return res.status(403).json({ message: "You can only delete media uploaded by your account" });
  }
  const url = `/uploads/${filename}`;
  const [listingReference, messageReference, announcementReference, avatarReference] = await Promise.all([
    prisma.listingImage.findFirst({ where: { url }, select: { id: true } }),
    prisma.message.findFirst({ where: { attachmentUrl: url }, select: { id: true } }),
    prisma.announcement.findFirst({
      where: {
        imageUrl: url,
        status: { in: ["PENDING", "ACTIVE"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      select: { id: true }
    }),
    prisma.user.findFirst({ where: { avatarUrl: url }, select: { id: true } })
  ]);
  if (listingReference || messageReference || announcementReference || avatarReference) {
    return res.status(409).json({ message: "This media is attached to published content and cannot be deleted" });
  }
  await removeFile(path.join(uploadDir, filename));
  res.status(204).send();
});

export default router;
