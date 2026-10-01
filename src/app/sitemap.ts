import type { MetadataRoute } from "next";

// Public landing sitemap is intentionally disabled for now.
// Re-enable it when production DB access during build/prerender is ready.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
