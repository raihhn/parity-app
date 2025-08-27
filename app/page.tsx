"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Clock, Play, RotateCcw } from "lucide-react";

type Parity = "Ganjil" | "Genap";
type Question = {
  id: string;
  a: number;
  b: number;
  sum: number;
  correct: Parity;
  user?: Parity;
  tStart: number;
  tEnd?: number;
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getParity(n: number): Parity {
  return n % 2 === 0 ? "Genap" : "Ganjil";
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function makeQuestion(): Question {
  const a = randInt(1, 9);
  const b = randInt(1, 9);
  return {
    id: uid(),
    a,
    b,
    sum: a + b,
    correct: getParity(a + b),
    tStart: Date.now(),
  };
}
function fmtClock(ms: number) {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

type SessionRow = {
  id: string;
  duration_min: number;
  started_at: number;
  ended_at: number;
  answered: number;
  correct: number;
  wrong: number;
  avg_seconds: number;
  notes?: string | null;
  created_at?: string;
};

export default function ParityTestApp() {
  // --------- quiz states ----------
  const [started, setStarted] = useState(false);
  const [durationMin, setDurationMin] = useState<number>(10);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showFinish, setShowFinish] = useState(false);

  const answeredCount = useMemo(() => questions.filter((q) => q.user !== undefined).length, [questions]);
  const correctCount = useMemo(() => questions.filter((q) => q.user === q.correct).length, [questions]);
  const wrongCount = answeredCount - correctCount;
  const remainingMs = deadline ? Math.max(0, deadline - now) : 0;

  // timer tick
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [started]);

  // show finish when time's up
  useEffect(() => {
    if (started && deadline && now >= deadline) setShowFinish(true);
  }, [now, started, deadline]);

  function handleStart() {
    setQuestions(Array.from({ length: 20 }, () => makeQuestion()));
    setDeadline(Date.now() + durationMin * 60 * 1000);
    setStarted(true);
  }

  function resetAll() {
    setStarted(false);
    setDeadline(null);
    setQuestions([]);
    setShowFinish(false);
    setNow(Date.now());
  }

  function answer(q: Question, ans: Parity) {
    if (q.user) return;
    q.user = ans;
    q.tEnd = Date.now();
    setQuestions([...questions]);
  }

  function finalizeSession() {
    const endedAt = Date.now();
    const series = questions
      .filter((q) => q.tEnd && q.tStart)
      .map((q, idx) => ({ x: idx + 1, seconds: (q.tEnd! - q.tStart) / 1000 }));

    const summary = {
      id: uid(),
      durationMin,
      startedAt: deadline ? deadline - durationMin * 60 * 1000 : Date.now(),
      endedAt,
      answered: answeredCount,
      correct: correctCount,
      wrong: wrongCount,
      avgSeconds: series.length ? series.reduce((a, b) => a + b.seconds, 0) / series.length : 0,
      speedSeries: series,
      notes: "",
    };

    // POST ke API (Neon)
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    }).catch((e) => console.warn("persist failed", e));

    // selesai -> balik ke home
    resetAll();
  }

  // --------- dashboard states ----------
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      const rows = (await res.json()) as SessionRow[];
      setSessions(rows);
      // siapkan draft notes dari DB
      const nd: Record<string, string> = {};
      rows.forEach((r) => (nd[r.id] = r.notes ?? ""));
      setNoteDrafts(nd);
    } catch (e) {
      console.warn("load sessions failed", e);
    } finally {
      setLoadingSessions(false);
    }
  }

  // setiap kali tidak bermain, muat dashboard
  useEffect(() => {
    if (!started) loadSessions();
  }, [started]);

  async function saveNote(id: string) {
    const notes = noteDrafts[id] ?? "";
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes }),
      });
    } catch (e) {
      console.warn("save note failed", e);
    }
  }

  // ------------------ UI ------------------
  return (
    <div className="min-h-screen bg-white text-stone-900 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Tes Ganjil / Genap</h1>
          {!started ? (
            <div className="flex gap-3">
              <Select value={String(durationMin)} onValueChange={(v) => setDurationMin(Number(v))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Durasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 menit</SelectItem>
                  <SelectItem value="5">5 menit</SelectItem>
                  <SelectItem value="10">10 menit</SelectItem>
                  <SelectItem value="15">15 menit</SelectItem>
                  <SelectItem value="30">30 menit</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleStart}>
                <Play className="w-4 h-4 mr-2" /> Mulai
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={resetAll}>
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
          )}
        </header>

        {/* Timer floating */}
        {started && (
          <div className="fixed right-4 top-4 z-40">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4" /> Timer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${remainingMs < 15000 ? "text-red-600" : ""}`}>
                  {Math.floor(remainingMs / 1000)}s
                </div>
                <Progress value={(1 - remainingMs / (durationMin * 60 * 1000)) * 100} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quiz */}
        {started && (
          <Card>
            <CardContent>
              <div className="flex flex-col gap-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="border rounded-xl p-4">
                    <div className="flex items-center mb-3">
                      <span className="mr-3 font-semibold text-stone-500">{idx + 1}</span>
                      <span className="text-xl font-semibold">
                        {q.a} + {q.b} =
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        className="flex-1"
                        variant={q.user === "Ganjil" ? "default" : "secondary"}
                        onClick={() => answer(q, "Ganjil")}
                        disabled={!!q.user}
                      >
                        Ganjil
                      </Button>
                      <Button
                        className="flex-1"
                        variant={q.user === "Genap" ? "default" : "secondary"}
                        onClick={() => answer(q, "Genap")}
                        disabled={!!q.user}
                      >
                        Genap
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard saat tidak main */}
        {!started && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Dashboard & Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-stone-600">
                  {loadingSessions ? "Memuat..." : `Total sesi: ${sessions.length}`}
                </div>
                <Button size="sm" variant="outline" onClick={loadSessions}>
                  Refresh
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left">Durasi</th>
                      <th className="py-2 pr-4 text-left">Terjawab</th>
                      <th className="py-2 pr-4 text-left">Benar</th>
                      <th className="py-2 pr-4 text-left">Salah</th>
                      <th className="py-2 pr-4 text-left">Rata² (dtk/soal)</th>
                      <th className="py-2 pr-4 text-left">Jam Tes</th>
                      <th className="py-2 pr-4 text-left">Catatan</th>
                      <th className="py-2 pr-4 text-left">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b align-top">
                        <td className="py-2 pr-4">{s.duration_min} mnt</td>
                        <td className="py-2 pr-4">{s.answered}</td>
                        <td className="py-2 pr-4">{s.correct}</td>
                        <td className="py-2 pr-4">{s.wrong}</td>
                        <td className="py-2 pr-4">{Number(s.avg_seconds).toFixed(2)}</td>
                        <td className="py-2 pr-4">
                          {fmtClock(Number(s.started_at))}–{fmtClock(Number(s.ended_at))}
                        </td>
                        <td className="py-2 pr-4">
                          <textarea
                            className="w-56 h-16 p-2 border rounded-md"
                            value={noteDrafts[s.id] ?? ""}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="Catatan sesi…"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <Button size="sm" onClick={() => saveNote(s.id)}>
                            Simpan
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && !loadingSessions && (
                      <tr>
                        <td className="py-3 text-stone-500" colSpan={8}>
                          Belum ada data. Mainkan tes lalu akhiri untuk mengisi dashboard.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal Selesai */}
        {showFinish && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Selesai</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  <li>
                    <b>Terjawab:</b> {answeredCount}
                  </li>
                  <li>
                    <b>Benar:</b> {correctCount}
                  </li>
                  <li>
                    <b>Salah:</b> {wrongCount}
                  </li>
                </ul>
                <div className="mt-4 flex justify-end gap-2">
                  <Button onClick={finalizeSession}>OK</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
