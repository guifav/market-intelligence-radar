import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const AUTH_SECRET = process.env.AUTH_SECRET || "mir-default-secret-change-me";
const secret = new TextEncoder().encode(AUTH_SECRET);

// Warn about default AUTH_SECRET at runtime (not during build/prerender)
if (typeof globalThis.addEventListener === "undefined") {
  // Server-side: check once when the module loads at runtime
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (
    !isBuild &&
    process.env.NODE_ENV === "production" &&
    (!AUTH_SECRET || AUTH_SECRET === "mir-default-secret-change-me")
  ) {
    console.warn(
      "\x1b[33mWARN: AUTH_SECRET is using the default value in production. " +
      "Set a strong, unique AUTH_SECRET in your environment variables.\x1b[0m"
    );
  }
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface MirUser {
  email: string;
}

export async function generateToken(email: string): Promise<string> {
  return await new jose.SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function requireUser(req: NextRequest): Promise<MirUser> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(401, "Missing or invalid authorization header");
  }
  const token = authHeader.slice(7);
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    if (!payload.email || typeof payload.email !== "string") {
      throw new AuthError(401, "Invalid token payload");
    }
    return { email: payload.email };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(401, "Invalid or expired token");
  }
}

// Backward compat aliases

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
