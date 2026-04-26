import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }
  return NextResponse.json({ suggestions: [] });
}
