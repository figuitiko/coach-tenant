export type TrainingActionState = { status: "idle" | "success" | "error"; message: string };

export const initialTrainingActionState: TrainingActionState = { status: "idle", message: "" };
