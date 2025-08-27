import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("session_id");
  if (!id) return NextResponse.json([], { status: 400 });

  const conn = process.env.DATABASE_URL;
  if (!conn) return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  const sql = neon(conn);

  try {
    const rows = await sql`
      SELECT question_index AS x, seconds
      FROM session_speeds
      WHERE session_id = ${id}
      ORDER BY question_index ASC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
