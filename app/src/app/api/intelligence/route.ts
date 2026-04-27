import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/server-auth";
import {
  listArticles,
  listPeople,
  listCompanies,
  listDeals,
  listSignals,
  getOverviewStats,
  getEnrichmentCounts,
  type PeopleFilter,
} from "@/lib/pg-queries";

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }

  const sp = req.nextUrl.searchParams;
  const tab = sp.get("tab") || "overview";
  const division = sp.get("division") || undefined;
  const search = sp.get("search") || undefined;
  const page = parseInt(sp.get("page") || "1");
  const pageSize = parseInt(sp.get("pageSize") || "50");

  try {
    if (tab === "overview") {
      const [stats, enrichment] = await Promise.all([
        getOverviewStats(division),
        getEnrichmentCounts(division),
      ]);
      return NextResponse.json({ stats, enrichment });
    }

    if (tab === "articles") {
      const result = await listArticles({ division, search, page, pageSize });
      return NextResponse.json(result);
    }

    if (tab === "people") {
      const peopleFilter = (sp.get("peopleFilter") || "all") as PeopleFilter;
      const result = await listPeople({ division, search, page, pageSize, peopleFilter });
      return NextResponse.json(result);
    }

    if (tab === "companies") {
      const result = await listCompanies({ division, search, page, pageSize });
      return NextResponse.json(result);
    }

    if (tab === "deals") {
      const result = await listDeals({ division, page, pageSize });
      return NextResponse.json(result);
    }

    if (tab === "signals") {
      const signalType = sp.get("signalType") || undefined;
      const capitalAction = sp.get("capitalAction") || undefined;
      const result = await listSignals({ division, page, pageSize, signalType, capitalAction });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown tab" }, { status: 400 });
  } catch (err) {
    console.error("Intelligence API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
