import { validateDraft, validatePublication, type LandingContentInput } from "../domain/contracts";
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
  content: LandingContentInput;
  idempotencyKey: string;
};

export type PreviewRevisionCommand = { revisionId: string };
export type UnpublishLandingCommand = { expectedPublishedRevisionId?: string | null; idempotencyKey: string };

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
    return this.repository.publishLanding(actor, { ...command, content: validatePublication(command.content) });
  }

  async unpublishLanding(actor: MarketingActor, command: UnpublishLandingCommand) {
    requireLandingAuthor(actor);
    return this.repository.unpublishLanding(actor, command);
  }
}

function requireLandingAuthor(actor: MarketingActor) {
  if (actor.role === "COACH") return;
  if (actor.role === "SUPER_ADMIN" && actor.accessMode === "WORKSPACE") return;
  throw new MarketingAccessDeniedError();
}
