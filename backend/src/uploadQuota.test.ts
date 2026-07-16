import { describe, expect, it } from "vitest";
import { env } from "./env.js";
import { chargeableUserUploadBytes, uploadQuotaExceeded } from "./routes/uploads.js";

describe("upload storage quota", () => {
  const mb = 1024 * 1024;

  it("allows usage at the configured limits", () => {
    expect(uploadQuotaExceeded({
      totalBytes: env.UPLOAD_MAX_TOTAL_MB * mb,
      userBytes: env.UPLOAD_MAX_USER_MB * mb
    })).toBe(false);
  });

  it("rejects either a user or global quota overflow", () => {
    expect(uploadQuotaExceeded({ totalBytes: 0, userBytes: env.UPLOAD_MAX_USER_MB * mb + 1 })).toBe(true);
    expect(uploadQuotaExceeded({ totalBytes: env.UPLOAD_MAX_TOTAL_MB * mb + 1, userBytes: 0 })).toBe(true);
  });

  it("does not charge immutable snapshot evidence to the seller's working quota", () => {
    expect(chargeableUserUploadBytes([
      { name: "seller-current.png", size: 2 * mb },
      { name: "seller-retained.png", size: 5 * mb }
    ], new Set(["/uploads/seller-retained.png"]))).toBe(2 * mb);
  });
});
