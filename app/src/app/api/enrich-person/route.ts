import { NextRequest, NextResponse } from "next/server";
import { getPerson, updatePersonEnrichment } from "@/lib/pg-queries";
import { requireUser, authErrorResponse } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }
  try {
    const { personId } = await req.json();
    if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

    const person = await getPerson(personId);
    if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

    // Enrichment would be handled by Python pipeline
    return NextResponse.json({ ok: true, message: "Enrichment is handled by the Python pipeline" });
  } catch (err) {
    console.error("Enrich error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
