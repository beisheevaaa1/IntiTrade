import fs from "node:fs";
import path from "node:path";

const localUploadPattern = /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif|mp4|mov|webm|ogg)$/i;

export function isLocalUploadUrl(url: string) {
  return url.startsWith("/uploads/");
}

export function isOwnedUploadUrl(userId: string, url: string, uploadRoot = path.resolve(process.cwd(), "uploads")) {
  const match = localUploadPattern.exec(url);
  if (!match || match[1].toLowerCase() !== userId.toLowerCase()) return false;

  const resolvedRoot = path.resolve(uploadRoot);
  const candidate = path.resolve(resolvedRoot, url.slice("/uploads/".length));
  if (path.dirname(candidate) !== resolvedRoot) return false;

  try {
    return fs.lstatSync(candidate).isFile();
  } catch {
    return false;
  }
}

export function canAttachMediaUrl(userId: string, url: string, uploadRoot?: string) {
  return isOwnedUploadUrl(userId, url, uploadRoot);
}

export function isOwnedImageUploadUrl(userId: string, url: string, uploadRoot?: string) {
  return isOwnedUploadUrl(userId, url, uploadRoot) && /\.(?:jpe?g|png|webp|gif)$/i.test(url);
}
