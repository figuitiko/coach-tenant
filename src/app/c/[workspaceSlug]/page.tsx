import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";
import { PublicCoachLanding } from "@/modules/marketing/presentation/public-coach-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const landing = await marketingService.getPublishedLanding(workspaceSlug);
  if (!landing) return { title: "Landing no publicada", robots: { index: false, follow: false } };
  return {
    title: landing.seo.title,
    description: landing.seo.description,
    alternates: { canonical: landing.seo.canonicalUrl },
    openGraph: {
      title: landing.seo.title,
      description: landing.seo.description,
      url: landing.seo.canonicalUrl,
      type: "website",
      images: landing.brand.portraitUrl ? [{ url: landing.brand.portraitUrl }] : undefined,
    },
  };
}

export default async function CoachPublicLandingPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const landing = await marketingService.getPublishedLanding(workspaceSlug);
  if (!landing) notFound();
  await marketingService.recordPublicLandingMetric(workspaceSlug, "VIEW");
  return <PublicCoachLanding landing={landing} />;
}
