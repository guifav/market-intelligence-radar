import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/server-auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }

  try {
    const division = req.nextUrl.searchParams.get("division") || undefined;
    const filter = division ? "WHERE divisions @> $1::jsonb" : "";
    const params = division ? [JSON.stringify([division])] : [];

    const rows = await query(
      `SELECT signal_type, capital_action, COUNT(*) as count
       FROM signals ${filter}
       GROUP BY signal_type, capital_action
       ORDER BY count DESC`,
      params
    );

    return NextResponse.json({ summary: rows });
  } catch (err) {
    console.error("Signals API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
