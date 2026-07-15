import fs from "node:fs";
import path from "node:path";
import { env } from "../env.js";
import { prisma } from "../prisma.js";

const uploadDir = path.resolve(process.cwd(), "uploads");
const ownedMediaPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f-]+\.(?:jpe?g|png|webp|gif|mp4|mov|webm|ogg)$/i;

async function main() {
  const cutoff = Date.now() - env.UPLOAD_ORPHAN_TTL_HOURS * 60 * 60 * 1000;
  await prisma.announcement.updateMany({
    where: {
      imageUrl: { not: null },
      OR: [{ status: "REJECTED" }, { expiresAt: { lte: new Date() } }]
    },
    data: { imageUrl: null }
  });
  const entries = await fs.promises.readdir(uploadDir, { withFileTypes: true }).catch(() => []);
  const candidates: Array<{ filename: string; url: string }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !ownedMediaPattern.test(entry.name)) continue;
    const stat = await fs.promises.stat(path.join(uploadDir, entry.name));
    if (stat.mtimeMs <= cutoff) candidates.push({ filename: entry.name, url: `/uploads/${entry.name}` });
  }

  let removed = 0;
  for (let offset = 0; offset < candidates.length; offset += 200) {
    const batch = candidates.slice(offset, offset + 200);
    const urls = batch.map((candidate) => candidate.url);
    const [listingReferences, messageReferences, announcementReferences, avatarReferences] = await Promise.all([
      prisma.listingImage.findMany({ where: { url: { in: urls } }, select: { url: true } }),
      prisma.message.findMany({ where: { attachmentUrl: { in: urls } }, select: { attachmentUrl: true } }),
      prisma.announcement.findMany({
        where: {
          imageUrl: { in: urls },
          status: { in: ["PENDING", "ACTIVE"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        select: { imageUrl: true }
      }),
      prisma.user.findMany({ where: { avatarUrl: { in: urls } }, select: { avatarUrl: true } })
    ]);
    const referenced = new Set([
      ...listingReferences.map((item) => item.url),
      ...messageReferences.map((item) => item.attachmentUrl).filter((url): url is string => Boolean(url)),
      ...announcementReferences.map((item) => item.imageUrl).filter((url): url is string => Boolean(url)),
      ...avatarReferences.map((item) => item.avatarUrl).filter((url): url is string => Boolean(url))
    ]);
    for (const candidate of batch) {
      if (referenced.has(candidate.url)) continue;
      await fs.promises.unlink(path.join(uploadDir, candidate.filename)).catch(() => undefined);
      removed += 1;
    }
  }

  console.log(JSON.stringify({ level: "info", event: "orphan_upload_cleanup", examined: candidates.length, removed, at: new Date().toISOString() }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ level: "error", event: "orphan_upload_cleanup_failed", errorType: error instanceof Error ? error.name : "UnknownError", at: new Date().toISOString() }));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
