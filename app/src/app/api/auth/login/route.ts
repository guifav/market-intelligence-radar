import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const authEmail = process.env.AUTH_EMAIL || "admin@example.com";
    const authPassword = process.env.AUTH_PASSWORD || "changeme";

    if (email !== authEmail || password !== authPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await generateToken(email);
    return NextResponse.json({ token, email });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
