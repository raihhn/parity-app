import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";
const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: Request) {
  const { id, notes } = await req.json();
  if (!id || notes === undefined) {
    return NextResponse.json({ error: "Missing id or notes" }, { status: 422 });
  }

  try {
    await sql`UPDATE sessions SET notes = ${notes} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Failed update notes", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
