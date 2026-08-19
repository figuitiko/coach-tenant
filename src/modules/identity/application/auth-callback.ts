const invitationCallbackPattern = /^\/invite\/([A-Za-z0-9_-]{32,256})$/;

export function safeRelativeCallback(input: string | null | undefined, fallback: string) {
  if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(input, "https://tenand.local");
    if (parsed.origin !== "https://tenand.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function invitationTokenFromCallback(callbackUrl: string) {
  return invitationCallbackPattern.exec(callbackUrl)?.[1] ?? null;
}
