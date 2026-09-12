import { NextResponse } from "next/server";
import { MarketingNotFoundError } from "@/modules/marketing/domain/errors";
import {
  marketingPrivateMediaFromEnvironment,
  MarketingPrivateMediaError,
} from "@/modules/marketing/infrastructure/marketing-private-media";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFoundHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceSlug: string; assetId: string }> },
) {
  try {
    const { workspaceSlug, assetId } = await params;
    const asset = await marketingService.getPublishedAsset(workspaceSlug, assetId);
    if (!asset) return new NextResponse(null, { status: 404, headers: notFoundHeaders });
    const stored = await marketingPrivateMediaFromEnvironment().fetchObject(asset.objectKey);
    return new Response(stored.body, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.sizeBytes),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof MarketingNotFoundError || error instanceof MarketingPrivateMediaError) {
      return new NextResponse(null, { status: 404, headers: notFoundHeaders });
    }
    throw error;
  }
}
