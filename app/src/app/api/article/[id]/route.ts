import { NextRequest, NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/server-auth";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireUser(req); } catch (e) { return authErrorResponse(e); }
  const { id } = await params;
  const article = await queryOne("SELECT * FROM articles WHERE article_id = $1", [id]);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}
