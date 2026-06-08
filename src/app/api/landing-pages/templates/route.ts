import { NextResponse } from "next/server";
import { listLandingPageTemplateSummaries } from "@/lib/landing-pages/inject";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ templates: listLandingPageTemplateSummaries() });
}
