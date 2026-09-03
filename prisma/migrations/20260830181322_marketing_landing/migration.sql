-- CreateEnum
CREATE TYPE "ResultAttributionMode" AS ENUM ('ANONYMOUS', 'FIRST_NAME_INITIAL', 'FULL_NAME');

-- CreateEnum
CREATE TYPE "PublicMetricUnit" AS ENUM ('KG', 'LB', 'CM', 'IN', 'PERCENT');

-- CreateEnum
CREATE TYPE "MarketingAssetKind" AS ENUM ('LOGO', 'PORTRAIT');

-- CreateTable
CREATE TABLE "CoachLanding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "currentDraftRevisionId" TEXT,
    "publishedRevisionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachLanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachLandingRevision" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "landingId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "themeKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "mutationKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "coachDisplayName" TEXT NOT NULL,
    "heroEyebrow" TEXT,
    "heroHeadline" TEXT NOT NULL,
    "heroSubheadline" TEXT NOT NULL,
    "valueProposition" TEXT,
    "servicesHeading" TEXT,
    "methodologyHeading" TEXT,
    "resultsHeading" TEXT,
    "aboutHeading" TEXT,
    "aboutBody" TEXT,
    "faqHeading" TEXT,
    "ctaHeading" TEXT NOT NULL,
    "ctaBody" TEXT,
    "whatsappDigits" TEXT NOT NULL,
    "whatsappMessage" TEXT NOT NULL,
    "instagramUrl" TEXT,
    "publicEmail" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "logoAssetId" TEXT,
    "portraitAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachLandingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingCredibilityFact" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "LandingCredibilityFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingProgram" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "LandingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingMethodStep" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "LandingMethodStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingFaq" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "LandingFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingRevisionResult" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "resultVersionId" TEXT NOT NULL,

    CONSTRAINT "LandingRevisionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResultStory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "studentMembershipId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentResultStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResultVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "narrative" TEXT,
    "testimonial" TEXT,
    "attributionMode" "ResultAttributionMode" NOT NULL DEFAULT 'ANONYMOUS',
    "attributionLabel" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "mutationKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentResultVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResultMetricSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "resultVersionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "beforeValue" DECIMAL(10,2) NOT NULL,
    "afterValue" DECIMAL(10,2) NOT NULL,
    "unit" "PublicMetricUnit" NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "StudentResultMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResultApproval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "resultVersionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "approvedFingerprint" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "approveMutationKey" TEXT NOT NULL,
    "revokeMutationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentResultApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAssetUploadIntent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" "MarketingAssetKind" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "UploadIntentStatus" NOT NULL DEFAULT 'PENDING',
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAssetUploadIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "MarketingAssetKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "uploadIntentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicLandingMetricDaily" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publishedRevisionId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "whatsappClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PublicLandingMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachLanding_workspaceId_key" ON "CoachLanding"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLanding_currentDraftRevisionId_key" ON "CoachLanding"("currentDraftRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLanding_publishedRevisionId_key" ON "CoachLanding"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLanding_id_workspaceId_key" ON "CoachLanding"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLanding_currentDraftRevisionId_workspaceId_key" ON "CoachLanding"("currentDraftRevisionId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLanding_publishedRevisionId_workspaceId_key" ON "CoachLanding"("publishedRevisionId", "workspaceId");

-- CreateIndex
CREATE INDEX "CoachLandingRevision_workspaceId_createdAt_idx" ON "CoachLandingRevision"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLandingRevision_landingId_revisionNumber_key" ON "CoachLandingRevision"("landingId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLandingRevision_workspaceId_mutationKey_key" ON "CoachLandingRevision"("workspaceId", "mutationKey");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLandingRevision_id_workspaceId_key" ON "CoachLandingRevision"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingCredibilityFact_revisionId_order_key" ON "LandingCredibilityFact"("revisionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LandingProgram_revisionId_order_key" ON "LandingProgram"("revisionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LandingMethodStep_revisionId_order_key" ON "LandingMethodStep"("revisionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LandingFaq_revisionId_order_key" ON "LandingFaq"("revisionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LandingRevisionResult_revisionId_order_key" ON "LandingRevisionResult"("revisionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LandingRevisionResult_revisionId_resultVersionId_key" ON "LandingRevisionResult"("revisionId", "resultVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultStory_currentVersionId_key" ON "StudentResultStory"("currentVersionId");

-- CreateIndex
CREATE INDEX "StudentResultStory_workspaceId_studentMembershipId_idx" ON "StudentResultStory"("workspaceId", "studentMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultStory_id_workspaceId_key" ON "StudentResultStory"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultStory_currentVersionId_workspaceId_key" ON "StudentResultStory"("currentVersionId", "workspaceId");

-- CreateIndex
CREATE INDEX "StudentResultVersion_workspaceId_storyId_idx" ON "StudentResultVersion"("workspaceId", "storyId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultVersion_storyId_versionNumber_key" ON "StudentResultVersion"("storyId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultVersion_workspaceId_mutationKey_key" ON "StudentResultVersion"("workspaceId", "mutationKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultVersion_id_workspaceId_key" ON "StudentResultVersion"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultMetricSnapshot_resultVersionId_order_key" ON "StudentResultMetricSnapshot"("resultVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultApproval_resultVersionId_key" ON "StudentResultApproval"("resultVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultApproval_workspaceId_approveMutationKey_key" ON "StudentResultApproval"("workspaceId", "approveMutationKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultApproval_resultVersionId_workspaceId_key" ON "StudentResultApproval"("resultVersionId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAssetUploadIntent_objectKey_key" ON "MarketingAssetUploadIntent"("objectKey");

-- CreateIndex
CREATE INDEX "MarketingAssetUploadIntent_workspaceId_createdById_status_idx" ON "MarketingAssetUploadIntent"("workspaceId", "createdById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAssetUploadIntent_workspaceId_idempotencyKey_key" ON "MarketingAssetUploadIntent"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAssetUploadIntent_id_workspaceId_key" ON "MarketingAssetUploadIntent"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAsset_objectKey_key" ON "MarketingAsset"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAsset_uploadIntentId_key" ON "MarketingAsset"("uploadIntentId");

-- CreateIndex
CREATE INDEX "MarketingAsset_workspaceId_kind_idx" ON "MarketingAsset"("workspaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAsset_workspaceId_idempotencyKey_key" ON "MarketingAsset"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAsset_id_workspaceId_key" ON "MarketingAsset"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAsset_uploadIntentId_workspaceId_key" ON "MarketingAsset"("uploadIntentId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicLandingMetricDaily_workspaceId_publishedRevisionId_da_key" ON "PublicLandingMetricDaily"("workspaceId", "publishedRevisionId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_id_workspaceId_key" ON "Membership"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "CoachLanding" ADD CONSTRAINT "CoachLanding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLanding" ADD CONSTRAINT "CoachLanding_currentDraftRevisionId_workspaceId_fkey" FOREIGN KEY ("currentDraftRevisionId", "workspaceId") REFERENCES "CoachLandingRevision"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLanding" ADD CONSTRAINT "CoachLanding_publishedRevisionId_workspaceId_fkey" FOREIGN KEY ("publishedRevisionId", "workspaceId") REFERENCES "CoachLandingRevision"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLandingRevision" ADD CONSTRAINT "CoachLandingRevision_landingId_workspaceId_fkey" FOREIGN KEY ("landingId", "workspaceId") REFERENCES "CoachLanding"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLandingRevision" ADD CONSTRAINT "CoachLandingRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLandingRevision" ADD CONSTRAINT "CoachLandingRevision_logoAssetId_workspaceId_fkey" FOREIGN KEY ("logoAssetId", "workspaceId") REFERENCES "MarketingAsset"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLandingRevision" ADD CONSTRAINT "CoachLandingRevision_portraitAssetId_workspaceId_fkey" FOREIGN KEY ("portraitAssetId", "workspaceId") REFERENCES "MarketingAsset"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingCredibilityFact" ADD CONSTRAINT "LandingCredibilityFact_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CoachLandingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingProgram" ADD CONSTRAINT "LandingProgram_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CoachLandingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingMethodStep" ADD CONSTRAINT "LandingMethodStep_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CoachLandingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingFaq" ADD CONSTRAINT "LandingFaq_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CoachLandingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingRevisionResult" ADD CONSTRAINT "LandingRevisionResult_revisionId_workspaceId_fkey" FOREIGN KEY ("revisionId", "workspaceId") REFERENCES "CoachLandingRevision"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingRevisionResult" ADD CONSTRAINT "LandingRevisionResult_resultVersionId_workspaceId_fkey" FOREIGN KEY ("resultVersionId", "workspaceId") REFERENCES "StudentResultVersion"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultStory" ADD CONSTRAINT "StudentResultStory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultStory" ADD CONSTRAINT "StudentResultStory_studentMembershipId_workspaceId_fkey" FOREIGN KEY ("studentMembershipId", "workspaceId") REFERENCES "Membership"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultStory" ADD CONSTRAINT "StudentResultStory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultStory" ADD CONSTRAINT "StudentResultStory_currentVersionId_workspaceId_fkey" FOREIGN KEY ("currentVersionId", "workspaceId") REFERENCES "StudentResultVersion"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultVersion" ADD CONSTRAINT "StudentResultVersion_storyId_workspaceId_fkey" FOREIGN KEY ("storyId", "workspaceId") REFERENCES "StudentResultStory"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultVersion" ADD CONSTRAINT "StudentResultVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultMetricSnapshot" ADD CONSTRAINT "StudentResultMetricSnapshot_resultVersionId_workspaceId_fkey" FOREIGN KEY ("resultVersionId", "workspaceId") REFERENCES "StudentResultVersion"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultApproval" ADD CONSTRAINT "StudentResultApproval_resultVersionId_workspaceId_fkey" FOREIGN KEY ("resultVersionId", "workspaceId") REFERENCES "StudentResultVersion"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultApproval" ADD CONSTRAINT "StudentResultApproval_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultApproval" ADD CONSTRAINT "StudentResultApproval_workspaceId_studentId_fkey" FOREIGN KEY ("workspaceId", "studentId") REFERENCES "Membership"("workspaceId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAssetUploadIntent" ADD CONSTRAINT "MarketingAssetUploadIntent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAssetUploadIntent" ADD CONSTRAINT "MarketingAssetUploadIntent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_uploadIntentId_workspaceId_fkey" FOREIGN KEY ("uploadIntentId", "workspaceId") REFERENCES "MarketingAssetUploadIntent"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicLandingMetricDaily" ADD CONSTRAINT "PublicLandingMetricDaily_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicLandingMetricDaily" ADD CONSTRAINT "PublicLandingMetricDaily_publishedRevisionId_workspaceId_fkey" FOREIGN KEY ("publishedRevisionId", "workspaceId") REFERENCES "CoachLandingRevision"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "StudentPlanAssignment_workspaceId_planId_studentMembershipId_ke" RENAME TO "StudentPlanAssignment_workspaceId_planId_studentMembershipI_key";
