import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicCoachLanding } from "./public-coach-landing";

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

describe("PublicCoachLanding", () => {
  it("renders only allowlisted public landing content and internal WhatsApp CTA", () => {
    render(<PublicCoachLanding landing={landing} />);

    expect(screen.getByRole("heading", { name: /entrená con dirección/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /resultados aprobados/i })).toBeInTheDocument();
    expect(screen.getByText(/90.00 → 84.00 kg/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /whatsapp|empezar|escribir/i })[0]).toHaveAttribute(
      "href",
      "/c/fuerza-norte/go/whatsapp",
    );
    expect(screen.queryByText(/student/i)).not.toBeInTheDocument();
  });
});
