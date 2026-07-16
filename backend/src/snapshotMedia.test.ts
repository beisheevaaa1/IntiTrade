import { describe, expect, it, vi } from "vitest";
import { snapshotMediaReferences } from "./utils/snapshotMedia.js";

describe("snapshot media references", () => {
  it("returns URLs retained by immutable relationship evidence", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      { url: "/uploads/approved.png" },
      { url: "/uploads/approved-video.mp4" }
    ]);
    const client = { $queryRaw: queryRaw } as unknown as Parameters<typeof snapshotMediaReferences>[0];

    const references = await snapshotMediaReferences(client, [
      "/uploads/approved.png",
      "/uploads/approved-video.mp4",
      "/uploads/orphan.png"
    ]);

    expect(references).toEqual(new Set([
      "/uploads/approved.png",
      "/uploads/approved-video.mp4"
    ]));
    expect(queryRaw).toHaveBeenCalledOnce();
    const query = queryRaw.mock.calls[0]?.[0] as { strings?: readonly string[] };
    expect(query.strings?.join("")).toContain("_snapshotProvenance");
  });

  it("does not query PostgreSQL for an empty candidate batch", async () => {
    const queryRaw = vi.fn();
    const client = { $queryRaw: queryRaw } as unknown as Parameters<typeof snapshotMediaReferences>[0];

    await expect(snapshotMediaReferences(client, [])).resolves.toEqual(new Set());
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
