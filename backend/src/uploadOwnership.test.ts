import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canAttachMediaUrl, isOwnedImageUploadUrl, isOwnedUploadUrl } from "./utils/uploadOwnership.js";

describe("uploaded media ownership", () => {
  const owner = "11111111-1111-4111-8111-111111111111";
  let uploadRoot: string;

  beforeEach(() => {
    uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "intitrade-upload-ownership-"));
    fs.writeFileSync(path.join(uploadRoot, `${owner}-asset-id.webp`), "test image");
    fs.writeFileSync(path.join(uploadRoot, `${owner}-asset-id.mp4`), "test video");
  });

  afterEach(() => fs.rmSync(uploadRoot, { recursive: true, force: true }));

  it("accepts only the owner's generated local filename", () => {
    expect(isOwnedUploadUrl(owner, `/uploads/${owner}-asset-id.webp`, uploadRoot)).toBe(true);
    expect(isOwnedUploadUrl(owner, `/uploads/${owner}-missing.webp`, uploadRoot)).toBe(false);
    expect(isOwnedUploadUrl(owner, "/uploads/22222222-2222-4222-8222-222222222222-asset-id.webp", uploadRoot)).toBe(false);
    expect(isOwnedUploadUrl(owner, "/uploads/legacy.webp", uploadRoot)).toBe(false);
  });

  it("rejects remote media and only accepts owned images as posters", () => {
    expect(canAttachMediaUrl(owner, "https://images.example.test/item.webp", uploadRoot)).toBe(false);
    expect(isOwnedImageUploadUrl(owner, `/uploads/${owner}-asset-id.webp`, uploadRoot)).toBe(true);
    expect(isOwnedImageUploadUrl(owner, `/uploads/${owner}-asset-id.mp4`, uploadRoot)).toBe(false);
  });
});
