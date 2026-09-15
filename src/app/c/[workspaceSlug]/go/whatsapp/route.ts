import { redirect } from "next/navigation";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const url = await marketingService.getPublishedLandingWhatsAppUrl(workspaceSlug);
  if (!url) return new Response("Not found", { status: 404 });
  await marketingService.recordPublicLandingMetric(workspaceSlug, "WHATSAPP_CLICK");
  redirect(url);
}
