import { NextRequest, NextResponse } from "next/server";
import { getPerson, updatePersonLeadStatus } from "@/lib/pg-queries";
import { requireUser, authErrorResponse } from "@/lib/server-auth";

const VALID_ACTIONS = ["approve", "reprove", "reset", "unapprove", "mark_not_relevant"];

export async function POST(req: NextRequest) {
  try { var user = await requireUser(req); } catch (e) { return authErrorResponse(e); }

  try {
    const body = await req.json();
    const { personId, personIds, action, reproveCategory } = body;

    // Support single personId or bulk personIds
    const ids: string[] = personIds?.length ? personIds : personId ? [personId] : [];
    if (ids.length === 0 || !action) {
      return NextResponse.json({ error: "Missing personId/personIds or action" }, { status: 400 });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Valid: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
    }

    // Map action to lead_status value
    let status: string | null;
    switch (action) {
      case "approve":
        status = "approved";
        break;
      case "reprove":
        status = "reproved";
        break;
      case "unapprove":
      case "reset":
        status = null;
        break;
      case "mark_not_relevant":
        status = "not_relevant";
        break;
      default:
        status = null;
    }

    // Process all IDs
    for (const id of ids) {
      const person = await getPerson(id);
      if (!person) continue; // skip missing persons in bulk
      await updatePersonLeadStatus(id, status, user.email, reproveCategory);
    }

    return NextResponse.json({ ok: true, processed: ids.length });
  } catch (err) {
    console.error("Lead action error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
