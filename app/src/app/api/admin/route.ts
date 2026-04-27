import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/server-auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }

  const action = req.nextUrl.searchParams.get("action") || "stats";

  try {
    if (action === "stats") {
      const [articles, people, companies] = await Promise.all([
        query<{count: string}>("SELECT COUNT(*) as count FROM articles"),
        query<{count: string}>("SELECT COUNT(*) as count FROM people WHERE is_author = FALSE"),
        query<{count: string}>("SELECT COUNT(*) as count FROM companies"),
      ]);
      return NextResponse.json({
        articles: parseInt(articles[0]?.count || "0"),
        people: parseInt(people[0]?.count || "0"),
        companies: parseInt(companies[0]?.count || "0"),
      });
    }

    if (action === "sources") {
      const fs = await import("fs");
      const path = await import("path");
      const sourcesPath = path.join(process.cwd(), "data", "sources.json");
      const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));
      return NextResponse.json({ sources });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Admin API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
