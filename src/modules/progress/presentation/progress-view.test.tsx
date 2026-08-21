import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CoachReviewView, PrivatePhotoUploader, StudentProgressView } from "./progress-view";

const action = vi.fn(async () => ({ status: "success" as const, message: "Guardado" }));

describe("progress views", () => {
  it("renders a mobile-first labelled metrics form with announced state and repeat-submit protection", () => {
    render(<StudentProgressView draft={{ id: "draft-1", status: "DRAFT", metrics: { weight: { value: 82.5, unit: "LB" }, waist: { value: 91, unit: "IN" } }, notes: "Persisted note", photos: [] }} history={[]} actions={{ saveOrSubmit: action, reply: action, requestUpload: action, attachPhoto: action }} />);
    expect(screen.getByRole("heading", { name: /tu progreso/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^peso$/i)).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByLabelText(/^peso$/i)).toHaveValue(82.5);
    expect(screen.getByLabelText(/unidad de peso/i)).toHaveValue("LB");
    expect(screen.getByLabelText(/^cintura$/i)).toHaveValue(91);
    expect(screen.getByLabelText(/unidad de cintura/i)).toHaveValue("IN");
    expect(screen.getByLabelText(/^notas$/i)).toHaveValue("Persisted note");
    expect(screen.getAllByRole("status").every(node => node.getAttribute("aria-live") === "polite")).toBe(true);
    expect(screen.getByRole("button", { name: /enviar check-in/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /guardar borrador/i })).toHaveAttribute("name", "intent");
    expect(screen.getByRole("button", { name: /enviar check-in/i })).toHaveAttribute("name", "intent");
  });

  it("shows coach feedback in student history and offers one contextual reply", () => {
    render(<StudentProgressView draft={{ id: "draft-1", status: "DRAFT", metrics: {}, notes: null, photos: [] }} history={[{
      id: "check-1", submittedAt: new Date("2026-08-20"), notes: "Bien",
      reviewNotes: [{ id: "note-1", body: "Sostené el descanso", createdAt: new Date("2026-08-20"), reply: null }],
    }]} actions={{ saveOrSubmit: action, reply: action, requestUpload: action, attachPhoto: action }} />);

    expect(screen.getByText("Sostené el descanso")).toBeVisible();
    expect(screen.getByRole("form", { name: /responder a la devolución/i })).toBeVisible();
  });

  it("uses accessible queue and review-detail semantics", () => {
    render(<CoachReviewView queue={[{ kind: "WORKOUT", id: "workout-1", studentId: "s", studentName: "Ana", submittedAt: new Date("2026-08-19") }]} history={[]} detail={null} reviewAction={action} />);
    expect(screen.getByRole("heading", { name: /cola de revisión/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /pendientes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /revisar entrenamiento de ana/i })).toBeInTheDocument();
  });

  it("puts student replies ahead of recent reviewed history with normal detail links", () => {
    render(<CoachReviewView queue={[]} history={[
      { kind: "CHECK_IN", id: "check-replied", studentId: "s1", studentName: "Ana", reviewedAt: new Date("2026-08-20"), reply: { body: "Entendido, gracias", createdAt: new Date("2026-08-21") } },
      { kind: "WORKOUT", id: "workout-reviewed", studentId: "s2", studentName: "Beto", reviewedAt: new Date("2026-08-19"), reply: null },
    ]} detail={null} reviewAction={action} />);

    const replied = screen.getByRole("region", { name: /respuestas de alumnos/i });
    expect(replied).toHaveTextContent("Entendido, gracias");
    expect(replied).toHaveTextContent(/revisado el/i);
    expect(replied).toHaveTextContent(/respondió el/i);
    expect(screen.getByRole("link", { name: /ver respuesta de ana/i })).toHaveAttribute("href", "?kind=CHECK_IN&itemId=check-replied");
    expect(screen.getByRole("region", { name: /revisados recientemente/i })).toHaveTextContent("Beto");
    expect(screen.getByRole("region", { name: /revisados recientemente/i })).toHaveTextContent(/revisado el/i);
    expect(screen.getByRole("link", { name: /ver revisión de beto/i })).toHaveAttribute("href", "?kind=WORKOUT&itemId=workout-reviewed");
  });

  it("reuses an upload key for retry, rotates it for a distinct file, and shows success", async () => {
    const keys: string[] = [];
    let requestCount = 0;
    const requestUpload = vi.fn(async (_state: unknown, data: FormData) => {
      keys.push(String(data.get("idempotencyKey")));
      requestCount += 1;
      if (requestCount === 1) return { status: "error" as const, message: "Reintentá" };
      return { status: "success" as const, message: "Preparada", upload: { url: "https://upload.test", headers: {}, intentId: `intent-${requestCount}`, expiresAt: "2026-08-20T12:00:00Z" } };
    });
    const attachPhoto = vi.fn(async () => ({ status: "success" as const, message: "Foto privada guardada." }));
    const randomUUID = vi.fn().mockReturnValueOnce("attempt-one").mockReturnValueOnce("attempt-two");
    vi.stubGlobal("crypto", { randomUUID, subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
    const user = userEvent.setup();
    render(<PrivatePhotoUploader checkInId="draft-1" requestUpload={requestUpload} attachPhoto={attachPhoto} />);
    const input = screen.getByLabelText(/foto privada/i);
    const first = new File(["one"], "one.webp", { type: "image/webp", lastModified: 1 });
    Object.defineProperty(first, "arrayBuffer", { value: async () => new TextEncoder().encode("one").buffer });
    await user.upload(input, first);
    await user.click(screen.getByRole("button", { name: /subir foto privada/i }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /subir foto privada/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Foto privada guardada.");

    const second = new File(["two"], "two.webp", { type: "image/webp", lastModified: 2 });
    Object.defineProperty(second, "arrayBuffer", { value: async () => new TextEncoder().encode("two").buffer });
    await user.upload(input, second);
    await user.click(screen.getByRole("button", { name: /subir foto privada/i }));
    expect(keys).toEqual(["attempt-one", "attempt-one", "attempt-two"]);
  });
});
