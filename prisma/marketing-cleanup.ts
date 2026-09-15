import type { PrismaClient } from "../src/generated/prisma/client";

type MarketingCleanupDatabase = Pick<
  PrismaClient,
  | "coachLanding"
  | "coachLandingRevision"
  | "landingCredibilityFact"
  | "landingFaq"
  | "landingMethodStep"
  | "landingProgram"
  | "landingRevisionResult"
  | "marketingAsset"
  | "marketingAssetUploadIntent"
  | "publicLandingMetricDaily"
  | "studentResultApproval"
  | "studentResultMetricSnapshot"
  | "studentResultStory"
  | "studentResultVersion"
>;

/**
 * Removes workspace-owned marketing aggregates before a workspace or membership
 * is deleted. Composite tenant foreign keys intentionally use RESTRICT around
 * aggregate pointers, so callers must use this order instead of deleting rows ad hoc.
 */
export async function deleteWorkspaceMarketingData(
  database: MarketingCleanupDatabase,
  workspaceIds: readonly string[],
) {
  if (workspaceIds.length === 0) return;

  const workspaceFilter = { in: [...workspaceIds] };

  await database.coachLanding.updateMany({
    where: { workspaceId: workspaceFilter },
    data: { currentDraftRevisionId: null, publishedRevisionId: null, publishedAt: null },
  });
  await database.studentResultStory.updateMany({
    where: { workspaceId: workspaceFilter },
    data: { currentVersionId: null },
  });

  await database.landingRevisionResult.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.landingCredibilityFact.deleteMany({ where: { revision: { workspaceId: workspaceFilter } } });
  await database.landingProgram.deleteMany({ where: { revision: { workspaceId: workspaceFilter } } });
  await database.landingMethodStep.deleteMany({ where: { revision: { workspaceId: workspaceFilter } } });
  await database.landingFaq.deleteMany({ where: { revision: { workspaceId: workspaceFilter } } });
  await database.publicLandingMetricDaily.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.studentResultApproval.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.studentResultMetricSnapshot.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.coachLandingRevision.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.coachLanding.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.studentResultVersion.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.studentResultStory.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.marketingAsset.deleteMany({ where: { workspaceId: workspaceFilter } });
  await database.marketingAssetUploadIntent.deleteMany({ where: { workspaceId: workspaceFilter } });
}
