import { timingSafeEqual } from "node:crypto";
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
    const emailMatches = constantTimeEqual(normalizeEmail(email), authEmail);
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

function normalizeEmail(value: unknown): unknown {
  return typeof value === "string" ? value.toLowerCase() : value;
}

function constantTimeEqual(actual: unknown, expected: string): boolean {
  const actualValue = typeof actual === "string" ? actual : "";
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualPrefix = actualValue.slice(0, expected.length + 1);
  const actualValueBuffer = Buffer.from(actualPrefix, "utf8");
  const actualBuffer = Buffer.alloc(expectedBuffer.length);
  actualValueBuffer.copy(actualBuffer, 0, 0, expectedBuffer.length);
  const lengthsMatch =
    actualPrefix.length === actualValue.length &&
    actualValueBuffer.length === expectedBuffer.length;
  return timingSafeEqual(actualBuffer, expectedBuffer) && lengthsMatch;
}
