import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/server-auth";

const DEFAULT_EMAIL = "admin@example.com";
const DEFAULT_PASSWORD = "changeme";

export async function POST(req: NextRequest) {
  try {
    const authEmail = process.env.AUTH_EMAIL || DEFAULT_EMAIL;
    const authPassword = process.env.AUTH_PASSWORD || DEFAULT_PASSWORD;

    // Block default credentials in production
    if (
      process.env.NODE_ENV === "production" &&
      authEmail === DEFAULT_EMAIL &&
      authPassword === DEFAULT_PASSWORD
    ) {
      return NextResponse.json(
        {
          error:
            "Default credentials are disabled in production. Set AUTH_EMAIL and AUTH_PASSWORD environment variables.",
        },
        { status: 503 }
      );
    }

    const { email, password } = await req.json();

    if (email !== authEmail || password !== authPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await generateToken(email);
    return NextResponse.json({ token, email });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
