import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedLanding: vi.fn(),
  recordPublicLandingMetric: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/marketing/infrastructure/marketing-use-cases", () => ({
  marketingService: {
    getPublishedLanding: mocks.getPublishedLanding,
    recordPublicLandingMetric: mocks.recordPublicLandingMetric,
  },
}));

import CoachPublicLandingPage, { generateMetadata } from "./page";

const landing = {
  workspaceSlug: "fuerza-norte",
  revisionId: "revision-1",
  themeKey: "editorial" as const,
  brand: { workspaceName: "Fuerza Norte", coachDisplayName: "Franco Rivera", logoUrl: null, portraitUrl: null },
  hero: { eyebrow: "Fuerza real", headline: "Entrená con dirección", subheadline: "Planes claros y seguimiento real." },
  credibility: [],
  programs: [{ title: "Plan online", description: "Rutina y revisión semanal." }],
  methodology: [{ title: "Evaluar", description: "Miramos tu punto de partida." }],
  results: [
    {
      publicId: "result-1",
      headline: "Más fuerte",
      narrative: "Ocho semanas de trabajo.",
      testimonial: null,
      attributionLabel: "Anónimo",
      metrics: [{ label: "Peso", before: "90.00", after: "84.00", unit: "KG" as const }],
    },
  ],
  about: { heading: "Sobre Franco", body: "Coach de fuerza para personas ocupadas." },
  faq: [{ question: "¿Necesito experiencia?", answer: "No." }],
  cta: { heading: "Empezar", body: "Hablemos.", href: "/c/fuerza-norte/go/whatsapp" },
  seo: { title: "Franco Rivera", description: "Entrenamiento online", canonicalUrl: "/c/fuerza-norte" },
};

describe("coach public landing page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders published landing and records an aggregate view", async () => {
    mocks.getPublishedLanding.mockResolvedValue(landing);

    render(await CoachPublicLandingPage({ params: Promise.resolve({ workspaceSlug: "fuerza-norte" }) }));

    expect(screen.getByRole("heading", { name: /entrená con dirección/i })).toBeInTheDocument();
    expect(mocks.recordPublicLandingMetric).toHaveBeenCalledWith("fuerza-norte", "VIEW");
  });

  it("returns noindex metadata for unpublished landings", async () => {
    mocks.getPublishedLanding.mockResolvedValue(null);

    await expect(generateMetadata({ params: Promise.resolve({ workspaceSlug: "draft" }) })).resolves.toMatchObject({
      robots: { index: false, follow: false },
    });
  });

  it("uses published landing SEO metadata", async () => {
    mocks.getPublishedLanding.mockResolvedValue(landing);

    await expect(
      generateMetadata({ params: Promise.resolve({ workspaceSlug: "fuerza-norte" }) }),
    ).resolves.toMatchObject({
      title: "Franco Rivera",
      description: "Entrenamiento online",
      alternates: { canonical: "/c/fuerza-norte" },
    });
  });
});
