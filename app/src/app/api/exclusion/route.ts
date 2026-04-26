import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/server-auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }
  const rules = await query("SELECT * FROM exclusion_rules WHERE active = TRUE ORDER BY created_at DESC");
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }
  const { rule_type, pattern, division, reason } = await req.json();
  const id = crypto.randomUUID().slice(0, 16);
  await query(
    `INSERT INTO exclusion_rules (id, rule_type, pattern, division, reason) VALUES ($1,$2,$3,$4,$5)`,
    [id, rule_type, pattern, division || "global", reason || ""]
  );
  return NextResponse.json({ id });
}
