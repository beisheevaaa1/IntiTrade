import type { Prisma } from "@prisma/client";

type AuditInput = {
  adminId: string;
  requestId?: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAdminAction(tx: Prisma.TransactionClient, input: AuditInput) {
  const actor = await tx.user.findUnique({
    where: { id: input.adminId },
    select: { email: true, role: true }
  });

  await tx.adminActionLog.create({
    data: {
      adminId: input.adminId,
      actorEmail: actor?.email,
      actorRole: actor?.role,
      requestId: input.requestId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      before: input.before,
      after: input.after,
      metadata: input.metadata
    }
  });
}
