import { describe, expect, it, vi } from "vitest";
import { ListingType, Prisma, TransactionStatus } from "@prisma/client";
import {
  listingInventoryConflict,
  settleProductInventory,
  transactionListingType
} from "./utils/listingInventory.js";

const listingId = "33333333-3333-4333-8333-333333333333";

function snapshot(type: ListingType): Prisma.JsonObject {
  return {
    _snapshotVersion: 1,
    _snapshotProvenance: "captured",
    id: listingId,
    status: "ACTIVE",
    type
  };
}

function transactionClient(holds: Array<{
  listingId: string;
  listingSnapshot: Prisma.JsonValue | null;
  quantity: number;
}>) {
  return {
    transaction: { findMany: vi.fn().mockResolvedValue(holds) }
  } as unknown as Prisma.TransactionClient;
}

describe("transaction inventory snapshots", () => {
  it("uses a valid captured snapshot or the guarded legacy cutover snapshot", () => {
    expect(transactionListingType(snapshot(ListingType.PRODUCT), listingId)).toBe(ListingType.PRODUCT);
    expect(transactionListingType(null, listingId)).toBeNull();
    expect(transactionListingType({ ...snapshot(ListingType.PRODUCT), id: "wrong" }, listingId)).toBeNull();
    expect(transactionListingType({ ...snapshot(ListingType.PRODUCT), status: "PENDING" }, listingId)).toBeNull();
    expect(transactionListingType({ ...snapshot(ListingType.PRODUCT), _snapshotProvenance: "reconstructed" }, listingId)).toBe(ListingType.PRODUCT);
  });

  it("blocks a type change while an approved product reservation is active", async () => {
    const tx = transactionClient([{
      listingId,
      listingSnapshot: snapshot(ListingType.PRODUCT),
      quantity: 2
    }]);

    const conflict = await listingInventoryConflict(tx, {
      listingId,
      nextType: ListingType.SERVICE,
      nextQuantity: 1
    });

    expect(conflict).toMatchObject({ kind: "TYPE", heldQuantity: 2 });
  });

  it("counts reserved and disputed product quantities before approving an edit", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { listingId, listingSnapshot: snapshot(ListingType.PRODUCT), quantity: 2 },
      { listingId, listingSnapshot: snapshot(ListingType.PRODUCT), quantity: 3 }
    ]);
    const tx = { transaction: { findMany } } as unknown as Prisma.TransactionClient;

    const conflict = await listingInventoryConflict(tx, {
      listingId,
      nextType: ListingType.PRODUCT,
      nextQuantity: 4
    });

    expect(conflict).toMatchObject({ kind: "QUANTITY", heldQuantity: 5 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        listingId,
        status: { in: [TransactionStatus.RESERVED, TransactionStatus.DISPUTED] }
      }
    }));
  });

  it("allows product quantity that still covers every active hold", async () => {
    const tx = transactionClient([
      { listingId, listingSnapshot: snapshot(ListingType.PRODUCT), quantity: 2 },
      { listingId, listingSnapshot: snapshot(ListingType.PRODUCT), quantity: 1 }
    ]);

    await expect(listingInventoryConflict(tx, {
      listingId,
      nextType: ListingType.PRODUCT,
      nextQuantity: 3
    })).resolves.toBeNull();
  });

  it("rejects a zero-stock product even when no reservation is active", async () => {
    const findMany = vi.fn();
    const tx = { transaction: { findMany } } as unknown as Prisma.TransactionClient;

    await expect(listingInventoryConflict(tx, {
      listingId,
      nextType: ListingType.PRODUCT,
      nextQuantity: 0
    })).resolves.toMatchObject({
      kind: "QUANTITY",
      heldQuantity: 0,
      message: "A product listing needs at least one item before it can be submitted or activated."
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("writes final product stock and SOLD status atomically", async () => {
    const findUnique = vi.fn().mockResolvedValue({ quantity: 2 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { listing: { findUnique, updateMany } } as unknown as Prisma.TransactionClient;

    await expect(settleProductInventory(tx, listingId, 2)).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: listingId, quantity: 2 },
      data: { quantity: 0, status: "SOLD" }
    });
  });

  it("refuses invalid legacy settlement quantities before touching inventory", async () => {
    const findUnique = vi.fn();
    const tx = { listing: { findUnique } } as unknown as Prisma.TransactionClient;

    await expect(settleProductInventory(tx, listingId, 0)).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
