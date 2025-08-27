import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge"; 
const sql = neon(process.env.DATABASE_URL!);

// POST: simpan data sesi
export async function POST(req: Request) {
  const body = await req.json();
  try {
    await sql`
      INSERT INTO sessions (id, duration_min, started_at, ended_at, answered, correct, wrong, avg_seconds, notes)
      VALUES (${body.id}, ${body.durationMin}, ${body.startedAt}, ${body.endedAt},
              ${body.answered}, ${body.correct}, ${body.wrong}, ${body.avgSeconds}, ${body.notes ?? null})
    `;
    for (const row of body.speedSeries as Array<{x:number;seconds:number}>) {
      await sql`
        INSERT INTO session_speeds (session_id, question_index, seconds)
        VALUES (${body.id}, ${row.x}, ${row.seconds})
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}

// GET: ambil semua sesi
export async function GET() {
  const rows = await sql`SELECT * FROM sessions ORDER BY created_at DESC`;
  return NextResponse.json(rows);
}
