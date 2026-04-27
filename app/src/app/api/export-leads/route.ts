import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/server-auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }

  const rows = await query(
    `SELECT name, title, company, email, linkedin_url, city, country, seniority, lead_status
     FROM people WHERE lead_status = 'approved' ORDER BY updated_at DESC`
  );

  const header = "Name,Title,Company,Email,LinkedIn,City,Country,Seniority,Status\n";
  const csv = rows.map(r =>
    [r.name, r.title, r.company, r.email, r.linkedin_url, r.city, r.country, r.seniority, r.lead_status]
      .map(v => `"${(String(v || "")).replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");

  return new NextResponse(header + csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=leads.csv" },
  });
}
