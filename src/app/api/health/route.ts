import { NextResponse } from "next/server";
import { prisma } from "@/shared/infrastructure/prisma";
import { evaluateReadiness } from "@/shared/infrastructure/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = await evaluateReadiness(() => prisma.$queryRaw`SELECT 1`);
  return NextResponse.json(readiness, {
    status: readiness.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
