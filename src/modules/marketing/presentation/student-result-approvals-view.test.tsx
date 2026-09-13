import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudentResultApprovalsView } from "./student-result-approvals-view";
import type { StudentResultApprovalDto } from "@/modules/marketing/application/marketing-service";

const baseApproval: StudentResultApprovalDto = {
  storyId: "story-a",
  versionId: "version-a",
  versionNumber: 2,
  fingerprint: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  state: "PENDING",
  content: {
    headline: "Mejor técnica y más constancia",
    narrative: "El progreso se midió durante ocho semanas.",
    testimonial: "Me siento más fuerte y con mejor energía.",
    attributionMode: "ANONYMOUS",
    attributionLabel: "Anónimo",
    metrics: [{ label: "Peso", beforeValue: 92, afterValue: 86.5, unit: "KG", order: 0 }],
  },
};

describe("StudentResultApprovalsView", () => {
  it("shows exact result content and an enabled approval action for pending versions", () => {
    render(<StudentResultApprovalsView actions={{ approve: vi.fn(), revoke: vi.fn() }} approvals={[baseApproval]} />);

    expect(screen.getByRole("heading", { name: /tus resultados/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /mejor técnica/i })).toBeInTheDocument();
    expect(screen.getByText(/92 → 86.5 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/1234567890abcdef/i)).toBeInTheDocument();

    const approve = screen.getByRole("button", { name: /aprobar versión exacta/i });
    expect(approve).toBeEnabled();
    expect(screen.getByRole("button", { name: /revocar aprobación/i })).toBeDisabled();
  });

  it("allows revocation only for approved versions and freezes replaced versions", () => {
    render(
      <StudentResultApprovalsView
        actions={{ approve: vi.fn(), revoke: vi.fn() }}
        approvals={[
          { ...baseApproval, versionId: "approved", state: "APPROVED" },
          { ...baseApproval, versionId: "replaced", state: "SUPERSEDED" },
        ]}
      />,
    );

    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).getByRole("button", { name: /aprobar versión exacta/i })).toBeDisabled();
    expect(within(cards[0]).getByRole("button", { name: /revocar aprobación/i })).toBeEnabled();
    expect(within(cards[1]).getByRole("button", { name: /aprobar versión exacta/i })).toBeDisabled();
    expect(within(cards[1]).getByRole("button", { name: /revocar aprobación/i })).toBeDisabled();
  });
});
