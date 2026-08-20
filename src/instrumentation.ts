export async function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME === "edge") return;
  const { validateProductionEnvironment } = await import("@/shared/infrastructure/env");
  validateProductionEnvironment(process.env);
}
