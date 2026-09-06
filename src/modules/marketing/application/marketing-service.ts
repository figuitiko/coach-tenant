import {
  validateDraft,
  validateResultVersion,
  type LandingContentInput,
  type ResultVersionInput,
} from "../domain/contracts";
import { MarketingAccessDeniedError } from "../domain/errors";

export type MarketingActorRole = "COACH" | "STUDENT" | "SUPER_ADMIN";
export type MarketingActor = {
  actorId: string;
  workspaceId: string;
  role: MarketingActorRole;
  accessMode?: "WORKSPACE" | "PLATFORM";
};

export type LandingRevisionCommand = {
  content: LandingContentInput;
  expectedRevisionNumber?: number | null;
  idempotencyKey: string;
  logoAssetId?: string | null;
  portraitAssetId?: string | null;
  selectedResultVersionIds?: string[];
};

export type PublishLandingCommand = {
  revisionId: string;
  expectedRevisionNumber: number;
  idempotencyKey: string;
};

export type PreviewRevisionCommand = { revisionId: string };
export type UnpublishLandingCommand = { expectedPublishedRevisionId?: string | null; idempotencyKey: string };
export type RequestResultApprovalCommand = {
  storyId?: string | null;
  studentMembershipId: string;
  expectedCurrentVersionId?: string | null;
  content: ResultVersionInput;
  idempotencyKey: string;
};
export type ApproveResultVersionCommand = { resultVersionId: string; fingerprint: string; idempotencyKey: string };
export type RevokeResultVersionCommand = { resultVersionId: string; idempotencyKey: string };

export type ResultApprovalRequestResult = {
  storyId: string;
  versionId: string;
  versionNumber: number;
  fingerprint: string;
  state: "PENDING" | "APPROVED" | "REVOKED" | "SUPERSEDED";
};
export type ResultApprovalDecisionResult = {
  storyId: string;
  versionId: string;
  fingerprint?: string;
  state: "APPROVED" | "REVOKED";
};
export type StudentResultApprovalDto = {
  storyId: string;
  versionId: string;
  versionNumber: number;
  fingerprint: string;
  content: ResultVersionInput;
  state: "PENDING" | "APPROVED" | "REVOKED" | "SUPERSEDED";
};

export type LandingMutationResult = {
  landingId: string;
  revisionId: string;
  revisionNumber: number;
  publishedRevisionId?: string | null;
  publishedAt?: Date | null;
};

export type UnpublishLandingResult = { landingId: string; unpublished: true; publishedRevisionId?: null };
export type LandingEditorDto = {
  landingId: string | null;
  currentDraftRevisionId: string | null;
  publishedRevisionId: string | null;
};
export type LandingPreviewDto = LandingMutationResult & { content: LandingContentInput; liveRevisionId: string | null };

export interface MarketingLandingRepository {
  getEditor(actor: MarketingActor): Promise<LandingEditorDto>;
  saveDraft(actor: MarketingActor, command: LandingRevisionCommand): Promise<LandingMutationResult>;
  previewRevision(actor: MarketingActor, command: PreviewRevisionCommand): Promise<LandingPreviewDto>;
  publishLanding(actor: MarketingActor, command: PublishLandingCommand): Promise<LandingMutationResult>;
  unpublishLanding(actor: MarketingActor, command: UnpublishLandingCommand): Promise<UnpublishLandingResult>;
  requestResultApproval(
    actor: MarketingActor,
    command: RequestResultApprovalCommand,
  ): Promise<ResultApprovalRequestResult>;
  listApprovalRequests(actor: MarketingActor): Promise<StudentResultApprovalDto[]>;
  approveResultVersion(
    actor: MarketingActor,
    command: ApproveResultVersionCommand,
  ): Promise<ResultApprovalDecisionResult>;
  revokeResultVersion(
    actor: MarketingActor,
    command: RevokeResultVersionCommand,
  ): Promise<ResultApprovalDecisionResult>;
}

export class MarketingService {
  constructor(private readonly repository: MarketingLandingRepository) {}

  async getEditor(actor: MarketingActor) {
    requireLandingAuthor(actor);
    return this.repository.getEditor(actor);
  }

  async saveDraft(actor: MarketingActor, command: LandingRevisionCommand) {
    requireLandingAuthor(actor);
    return this.repository.saveDraft(actor, { ...command, content: validateDraft(command.content) });
  }

  async previewRevision(actor: MarketingActor, command: PreviewRevisionCommand) {
    requireLandingAuthor(actor);
    return this.repository.previewRevision(actor, command);
  }

  async publishLanding(actor: MarketingActor, command: PublishLandingCommand) {
    requireLandingAuthor(actor);
    return this.repository.publishLanding(actor, command);
  }

  async unpublishLanding(actor: MarketingActor, command: UnpublishLandingCommand) {
    requireLandingAuthor(actor);
    return this.repository.unpublishLanding(actor, command);
  }

  async requestResultApproval(actor: MarketingActor, command: RequestResultApprovalCommand) {
    requireLandingAuthor(actor);
    return this.repository.requestResultApproval(actor, {
      ...command,
      content: validateResultVersion(command.content),
    });
  }

  async listApprovalRequests(actor: MarketingActor) {
    requireStudent(actor);
    return this.repository.listApprovalRequests(actor);
  }

  async approveResultVersion(actor: MarketingActor, command: ApproveResultVersionCommand) {
    requireStudent(actor);
    return this.repository.approveResultVersion(actor, command);
  }

  async revokeResultVersion(actor: MarketingActor, command: RevokeResultVersionCommand) {
    requireStudent(actor);
    return this.repository.revokeResultVersion(actor, command);
  }
}

function requireLandingAuthor(actor: MarketingActor) {
  if (actor.role === "COACH") return;
  if (actor.role === "SUPER_ADMIN" && actor.accessMode === "WORKSPACE") return;
  throw new MarketingAccessDeniedError();
}

function requireStudent(actor: MarketingActor) {
  if (actor.role !== "STUDENT") throw new MarketingAccessDeniedError();
}
