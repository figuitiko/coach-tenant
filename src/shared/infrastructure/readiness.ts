export async function evaluateReadiness(databaseProbe: () => Promise<unknown>) {
  try {
    await databaseProbe();
    return { status: "ready" as const, checks: { database: "up" as const } };
  } catch {
    return { status: "not_ready" as const, checks: { database: "down" as const } };
  }
}
