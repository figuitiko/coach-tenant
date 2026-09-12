import { MarketingValidationError } from "./errors";

export type MarketingAssetKind = "LOGO" | "PORTRAIT";
export type MarketingAssetMimeType = "image/jpeg" | "image/png" | "image/webp";

export const MARKETING_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const MARKETING_ASSET_MIME_TYPES: readonly MarketingAssetMimeType[] = ["image/jpeg", "image/png", "image/webp"];

export function validateMarketingAssetInput(input: {
  kind: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}) {
  if (!["LOGO", "PORTRAIT"].includes(input.kind))
    throw new MarketingValidationError("Unsupported marketing asset kind");
  if (!MARKETING_ASSET_MIME_TYPES.includes(input.mimeType as MarketingAssetMimeType)) {
    throw new MarketingValidationError("Unsupported marketing asset type");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MARKETING_ASSET_MAX_BYTES) {
    throw new MarketingValidationError("Marketing asset is too large");
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(input.checksumSha256)) {
    throw new MarketingValidationError("Invalid SHA-256 checksum");
  }
}
