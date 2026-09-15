import type { MetadataRoute } from "next";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";

export const runtime = "nodejs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await marketingService.listPublishedLandingSitemapEntries();
  return entries.map((entry) => ({
    url: `/c/${entry.workspaceSlug}`,
    lastModified: entry.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
}
