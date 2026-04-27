import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const DEFAULT_SECRET = "mir-default-secret-change-me";
const AUTH_SECRET = process.env.AUTH_SECRET || DEFAULT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
const HAS_INSECURE_SECRET =
  !process.env.AUTH_SECRET ||
  AUTH_SECRET === DEFAULT_SECRET ||
  AUTH_SECRET === "mir-local-dev-secret" ||
  AUTH_SECRET === "mir-docker-secret";

const secret = new TextEncoder().encode(AUTH_SECRET);

// In production with default/insecure secret: fail hard at startup
if (!IS_BUILD && IS_PRODUCTION && HAS_INSECURE_SECRET) {
  console.error(
    "\x1b[31mFATAL: AUTH_SECRET is not configured for production. " +
    "Set a strong, unique AUTH_SECRET environment variable. " +
    "The server will reject all authentication requests until this is fixed.\x1b[0m"
  );
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
  if (IS_PRODUCTION && HAS_INSECURE_SECRET) {
    throw new AuthError(503, "Server misconfigured: AUTH_SECRET not set for production");
  }
  return await new jose.SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function requireUser(req: NextRequest): Promise<MirUser> {
  if (IS_PRODUCTION && HAS_INSECURE_SECRET) {
    throw new AuthError(503, "Server misconfigured: AUTH_SECRET not set for production");
  }
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
