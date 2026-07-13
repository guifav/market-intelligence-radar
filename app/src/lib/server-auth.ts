import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { AuthConfigurationError, getAuthConfig } from "./auth-config";

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
  const { secret } = getAuthConfig();
  return await new jose.SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

export async function requireUser(req: NextRequest): Promise<MirUser> {
  const { secret } = getAuthConfig();
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(401, "Missing or invalid authorization header");
  }
  const token = authHeader.slice(7);
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(secret));
    if (!payload.email || typeof payload.email !== "string") {
      throw new AuthError(401, "Invalid token payload");
    }
    return { email: payload.email };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(401, "Invalid or expired token");
  }
}

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthConfigurationError || err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
