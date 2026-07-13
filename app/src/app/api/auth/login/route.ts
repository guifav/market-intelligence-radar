import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth-config";
import { authErrorResponse, generateToken } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { email: authEmail, password: authPassword } = getAuthConfig();
    if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const email = isRecord(body) ? body.email : undefined;
    const password = isRecord(body) ? body.password : undefined;
    const emailMatches = constantTimeEqual(email, authEmail);
    const passwordMatches = constantTimeEqual(password, authPassword);

    if (!emailMatches || !passwordMatches) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await generateToken(authEmail);
    return NextResponse.json({ token, email: authEmail });
  } catch (error) {
    return authErrorResponse(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function constantTimeEqual(actual: unknown, expected: string): boolean {
  const actualValue = typeof actual === "string" ? actual : "";
  const actualDigest = createHash("sha256").update(actualValue, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
