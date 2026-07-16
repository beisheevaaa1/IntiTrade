import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queryRaw = vi.fn();
  const conversationFindUnique = vi.fn();
  const conversationUpdate = vi.fn();
  const userBlockFindFirst = vi.fn();
  const messageCreate = vi.fn();
  const tx = {
    $queryRaw: queryRaw,
    conversation: { findUnique: conversationFindUnique, update: conversationUpdate },
    userBlock: { findFirst: userBlockFindFirst },
    message: { create: messageCreate }
  };
  return {
    queryRaw,
    conversationFindUnique,
    conversationUpdate,
    userBlockFindFirst,
    messageCreate,
    transaction: vi.fn(),
    tx
  };
});

vi.mock("./prisma.js", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("./socket.js", () => ({ getIo: () => null }));

import { sendQueuedAutoReply } from "./utils/autoReply.js";

const conversationId = "11111111-1111-4111-8111-111111111111";
const senderId = "22222222-2222-4222-8222-222222222222";
const recipientId = "33333333-3333-4333-8333-333333333333";

function conversation(lastSenderId = senderId) {
  return {
    id: conversationId,
    buyerId: senderId,
    sellerId: recipientId,
    buyer: {
      id: senderId,
      isBlocked: false,
      autoReplyEnabled: false,
      autoReplyMessage: ""
    },
    seller: {
      id: recipientId,
      isBlocked: false,
      autoReplyEnabled: true,
      autoReplyMessage: "Away right now"
    },
    messages: [{ id: "message-id", senderId: lastSenderId }]
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  mocks.transaction.mockImplementation(async (operation: (tx: typeof mocks.tx) => unknown) => operation(mocks.tx));
  mocks.conversationFindUnique.mockResolvedValue(conversation());
  mocks.userBlockFindFirst.mockResolvedValue(null);
  mocks.messageCreate.mockResolvedValue({
    id: "auto-reply-id",
    conversationId,
    senderId: recipientId,
    body: "Away right now",
    sender: { id: recipientId, name: "Seller" }
  });
  mocks.conversationUpdate.mockResolvedValue({});
});

describe("queued auto replies", () => {
  it("rechecks and creates the reply while participant and conversation locks are held", async () => {
    const result = await sendQueuedAutoReply(conversationId, senderId, recipientId);

    expect(result).toMatchObject({ id: "auto-reply-id", senderId: recipientId });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(4);
    expect(mocks.queryRaw.mock.invocationCallOrder[3]).toBeLessThan(mocks.conversationFindUnique.mock.invocationCallOrder[0]);
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ conversationId, senderId: recipientId, body: "Away right now" })
    }));
    expect(mocks.conversationUpdate).toHaveBeenCalledOnce();
  });

  it("does not reply when a manual recipient message won the serialized race", async () => {
    mocks.conversationFindUnique.mockResolvedValue(conversation(recipientId));

    await expect(sendQueuedAutoReply(conversationId, senderId, recipientId)).resolves.toBeNull();
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it("does not reply when either participant blocked the other", async () => {
    mocks.userBlockFindFirst.mockResolvedValue({ id: "block-id" });

    await expect(sendQueuedAutoReply(conversationId, senderId, recipientId)).resolves.toBeNull();
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });
});
