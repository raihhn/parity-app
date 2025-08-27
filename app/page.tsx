"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Clock, Play, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// =====================================
// Types
// =====================================
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

type SpeedPoint = { x: number; seconds: number };

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

// =====================================
// Utils
// =====================================
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
  return { id: uid(), a, b, sum: a + b, correct: getParity(a + b), tStart: Date.now() };
}
function fmtClock(ms: number) {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// =====================================
// Component
// =====================================
export default function ParityTestApp() {
  // -------- Quiz state --------
  const [started, setStarted] = useState(false);
  const [durationMin, setDurationMin] = useState<number>(10);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // answer reveal mode (2 opsi: none / after)
  type RevealMode = "none" | "after";
  const [revealMode, setRevealMode] = useState<RevealMode>("none");

  // paging: 20 soal per halaman
  const PAGE_SIZE = 20;
  const [pages, setPages] = useState<Question[][]>([]);
  const [pageIdx, setPageIdx] = useState(0);

  const currentPageQuestions = pages[pageIdx] ?? [];
  const allQuestions = pages.flat();

  const answeredCount = useMemo(() => allQuestions.filter((q) => q.user !== undefined).length, [pages]);
  const correctCount = useMemo(() => allQuestions.filter((q) => q.user === q.correct).length, [pages]);
  const wrongCount = answeredCount - correctCount;
  const remainingMs = deadline ? Math.max(0, deadline - now) : 0;

  const [showFinish, setShowFinish] = useState(false);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [started]);

  useEffect(() => {
    if (started && deadline && now >= deadline) setShowFinish(true);
  }, [now, started, deadline]);

  function handleStart() {
    const firstPage = Array.from({ length: PAGE_SIZE }, () => makeQuestion());
    setPages([firstPage]);
    setPageIdx(0);
    setDeadline(Date.now() + durationMin * 60 * 1000);
    setStarted(true);
  }

  function resetAll() {
    setStarted(false);
    setDeadline(null);
    setPages([]);
    setPageIdx(0);
    setShowFinish(false);
    setNow(Date.now());
  }

  function answer(q: Question, ans: Parity) {
    if (q.user) return;
    q.user = ans;
    q.tEnd = Date.now();
    setPages((prev) => prev.map((p) => p.slice()));
  }

  function nextPage() {
    setPages((prev) => {
      const nextIndex = pageIdx + 1;
      if (prev[nextIndex]) {
        setPageIdx(nextIndex);
        return prev;
      }
      const newPage = Array.from({ length: PAGE_SIZE }, () => makeQuestion());
      const updated = [...prev, newPage];
      setPageIdx(nextIndex);
      return updated;
    });
  }

  function prevPage() {
    setPageIdx((i) => Math.max(0, i - 1));
  }

  function finalizeSession() {
    const endedAt = Date.now();
    const series: SpeedPoint[] = allQuestions
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

    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    }).catch((e) => console.warn("persist failed", e));

    resetAll();
  }

  // -------- Dashboard state --------
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [speedCache, setSpeedCache] = useState<Record<string, SpeedPoint[]>>({});
  const [durationFilter, setDurationFilter] = useState<string>("all");

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const url = durationFilter === "all" ? "/api/sessions" : `/api/sessions?duration=${durationFilter}`;
      const res = await fetch(url, { cache: "no-store" });
      const rows = (await res.json()) as SessionRow[];
      setSessions(rows);
      const nd: Record<string, string> = {};
      rows.forEach((r) => (nd[r.id] = r.notes ?? ""));
      setNoteDrafts(nd);
    } catch (e) {
      console.warn("load sessions failed", e);
    } finally {
      setLoadingSessions(false);
    }
  }

  useEffect(() => {
    if (!started) loadSessions();
  }, [started, durationFilter]);

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!speedCache[id]) {
      try {
        const res = await fetch(`/api/speeds?session_id=${id}`, { cache: "no-store" });
        const rows = (await res.json()) as SpeedPoint[];
        setSpeedCache((p) => ({ ...p, [id]: rows }));
      } catch (e) {
        console.warn("load speeds failed", e);
      }
    }
  }

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

  const filtered = sessions;

  return (
    <div className="min-h-screen bg-white text-stone-900 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Tes Ganjil / Genap</h1>
          {!started ? (
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-600">Durasi</span>
                <Select value={String(durationMin)} onValueChange={(v) => setDurationMin(Number(v))}>
                  <SelectTrigger className="w-[140px]">
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
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-600">Mode jawaban</span>
                <Select value={revealMode} onValueChange={(v: RevealMode) => setRevealMode(v)}>
                  <SelectTrigger className="w-[210px]">
                    <SelectValue placeholder="Mode jawaban" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Jangan tampilkan kunci</SelectItem>
                    <SelectItem value="after">Tampilkan setelah jawab</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleStart}>
                <Play className="w-4 h-4 mr-2" /> Mulai
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={resetAll}>
                <RotateCcw className="w-4 h-4 mr-2" /> Reset
              </Button>
            </div>
          )}
        </header>

        {/* Floating Timer */}
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

        {/* Quiz with paging */}
        {started && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Halaman {pageIdx + 1}</CardTitle>
                <div className="text-sm text-stone-600">
                  Terjawab: {answeredCount} • Benar: {correctCount} • Salah: {wrongCount}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {currentPageQuestions.map((q, idx) => (
                  <div key={q.id} className="border rounded-xl p-4">
                    <div className="flex items-center mb-3 justify-between">
                      <div className="flex items-center">
                        <span className="mr-3 font-semibold text-stone-500">{idx + 1 + pageIdx * PAGE_SIZE}</span>
                        <span className="text-xl font-semibold">{q.a} + {q.b} =</span>
                      </div>
                      {revealMode === "after" && q.user && (
                        <span className={`text-xs px-2 py-1 rounded-full ${q.user === q.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {q.user === q.correct ? "Benar" : `Salah • Kunci: ${q.correct}`}
                        </span>
                      )}
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

        {/* Sticky paging nav */}
        {started && (
          <div className="sticky bottom-0 mt-4">
            <div className="bg-white/95 backdrop-blur border rounded-xl p-3 flex items-center justify-between shadow-sm">
              <Button variant="outline" onClick={prevPage} disabled={pageIdx === 0}>Sebelumnya</Button>
              <div className="text-sm text-stone-600">Halaman {pageIdx + 1}</div>
              <Button onClick={nextPage}>Selanjutnya</Button>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {!started && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Dashboard & Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="text-sm text-stone-600">
                  {loadingSessions ? "Memuat..." : `Total sesi: ${filtered.length}`}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={durationFilter} onValueChange={(v) => setDurationFilter(v)}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Filter durasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua durasi</SelectItem>
                      <SelectItem value="1">1 menit</SelectItem>
                      <SelectItem value="5">5 menit</SelectItem>
                      <SelectItem value="10">10 menit</SelectItem>
                      <SelectItem value="15">15 menit</SelectItem>
                      <SelectItem value="30">30 menit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={loadSessions}>Refresh</Button>
                </div>
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
                      <th className="py-2 pr-4 text-left">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const isOpen = expanded === s.id;
                      const speeds = speedCache[s.id] ?? [];
                      return (
                        <React.Fragment key={s.id}>
                          <tr className="border-b align-top">
                            <td className="py-2 pr-4">{s.duration_min} mnt</td>
                            <td className="py-2 pr-4">{s.answered}</td>
                            <td className="py-2 pr-4">{s.correct}</td>
                            <td className="py-2 pr-4">{s.wrong}</td>
                            <td className="py-2 pr-4">{Number(s.avg_seconds).toFixed(2)}</td>
                            <td className="py-2 pr-4">{fmtClock(Number(s.started_at))} – {fmtClock(Number(s.ended_at))}</td>
                            <td className="py-2 pr-4">
                              <textarea
                                className="w-56 h-16 p-2 border rounded-md"
                                value={noteDrafts[s.id] ?? ""}
                                onChange={(e) => setNoteDrafts((p) => ({ ...p, [s.id]: e.target.value }))}
                                placeholder="Catatan sesi…"
                              />
                              <div className="mt-2">
                                <Button size="sm" onClick={() => saveNote(s.id)}>Simpan</Button>
                              </div>
                            </td>
                            <td className="py-2 pr-4">
                              <Button size="sm" variant="ghost" onClick={() => toggleExpand(s.id)}>
                                {isOpen ? (<span className="inline-flex items-center gap-1">Tutup <ChevronUp className="w-4 h-4"/></span>) : (<span className="inline-flex items-center gap-1">Lihat grafik <ChevronDown className="w-4 h-4"/></span>)}
                              </Button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b">
                              <td colSpan={8} className="py-4">
                                {speeds.length === 0 ? (
                                  <div className="text-stone-500 text-sm">Memuat grafik… atau belum ada data kecepatan.</div>
                                ) : (
                                  <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={speeds} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="x" label={{ value: "No. Soal", position: "insideBottomRight", offset: -5 }} />
                                        <YAxis label={{ value: "Detik", angle: -90, position: "insideLeft" }} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="seconds" name="Detik per soal" dot={false} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filtered.length === 0 && !loadingSessions && (
                      <tr>
                        <td colSpan={8} className="py-4 text-stone-500">Belum ada data. Mainkan tes lalu akhiri untuk mengisi dashboard.</td>
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
                  <li><b>Terjawab:</b> {answeredCount}</li>
                  <li><b>Benar:</b> {correctCount}</li>
                  <li><b>Salah:</b> {wrongCount}</li>
                  <li><b>Rata-rata detik/soal:</b> {(() => {
                    const arr = allQuestions.filter(q=>q.tEnd && q.tStart).map(q => (q.tEnd!-q.tStart)/1000);
                    if (!arr.length) return 0;
                    return (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2);
                  })()}</li>
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
