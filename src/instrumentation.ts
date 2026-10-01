export async function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME === "edge") return;
  const { validateProductionEnvironment } = await import("@/shared/infrastructure/env");
  try {
    validateProductionEnvironment(process.env);
  } catch (error) {
    console.warn(
      "Production environment validation failed. Some runtime features may be unavailable until environment variables are configured.",
      error instanceof Error ? error.message : error,
    );
  }
}
