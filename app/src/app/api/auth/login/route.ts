import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth-config";
import { authErrorResponse, generateToken } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { email: authEmail, password: authPassword } = getAuthConfig();
    const { email, password } = await req.json();

    if (email !== authEmail || password !== authPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await generateToken(email);
    return NextResponse.json({ token, email });
  } catch (error) {
    return authErrorResponse(error);
  }
}
