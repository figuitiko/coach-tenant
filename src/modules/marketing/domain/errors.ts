export class MarketingError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = new.target.name; }
}
export class MarketingValidationError extends MarketingError {
  constructor(message: string, readonly fields: Record<string, string> = {}) { super(message, "VALIDATION"); }
}
export class MarketingAccessDeniedError extends MarketingError { constructor() { super("Marketing access denied", "ACCESS_DENIED"); } }
export class MarketingNotFoundError extends MarketingError { constructor() { super("Marketing resource not found", "NOT_FOUND"); } }
export class MarketingConflictError extends MarketingError { constructor(message = "Marketing mutation conflict") { super(message, "CONFLICT"); } }
export class MarketingPublicationBlockedError extends MarketingError {
  constructor(readonly blockers: readonly PublicationBlocker[]) { super("Landing publication is blocked", "PUBLICATION_BLOCKED"); }
}
export type PublicationBlocker = "PENDING_APPROVAL" | "REVOKED" | "SUPERSEDED";
export class UnknownLandingThemeError extends MarketingError { constructor(theme: string) { super(`Unknown landing theme: ${theme}`, "UNKNOWN_THEME"); } }
