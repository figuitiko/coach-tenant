import { describe, expect, it, vi } from "vitest";
import { PrismaProgressRepository } from "./prisma-progress-repository";

describe("PrismaProgressRepository photo ownership", () => {
  it("does not return an attachment owned by another workspace/student when an intent ID is guessed", async () => {
    const foreignPhoto = { id: "foreign-photo" };
    const transaction = {
      membership: { findFirst: vi.fn(async () => ({ id: "member" })) },
      progressPhoto: {
        findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => "uploadIntentId" in where ? foreignPhoto : null),
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => where.uploadIntentId === "foreign-intent" && where.workspaceId === "workspace-a" && where.studentId === "student-a" ? null : foreignPhoto),
      },
      photoUploadIntent: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };
    const database = { $transaction: vi.fn(async (operation: (tx: typeof transaction) => unknown) => operation(transaction)) };
    const repository = new PrismaProgressRepository(database as never);

    await expect(repository.attachPhoto({ workspaceId: "workspace-a", studentId: "student-a", uploadIntentId: "foreign-intent", attachedAt: new Date() })).resolves.toBeNull();
    expect(transaction.progressPhoto.findFirst).toHaveBeenCalledWith({ where: { uploadIntentId: "foreign-intent", workspaceId: "workspace-a", studentId: "student-a" }, select: { id: true } });
  });
});
