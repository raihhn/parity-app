"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Clock, Play } from "lucide-react";

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
  return Math.random().toString(36).substring(2, 9);
}
function makeQuestion(): Question {
  const a = randInt(1, 9);
  const b = randInt(1, 9);
  return { id: uid(), a, b, sum: a + b, correct: getParity(a + b), tStart: Date.now() };
}

export default function ParityTestApp() {
  const [started, setStarted] = useState(false);
  const [durationMin, setDurationMin] = useState<number>(1);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showFinish, setShowFinish] = useState(false);

  const answeredCount = useMemo(() => questions.filter((q) => q.user !== undefined).length, [questions]);
  const correctCount = useMemo(() => questions.filter((q) => q.user === q.correct).length, [questions]);
  const wrongCount = answeredCount - correctCount;
  const remainingMs = deadline ? Math.max(0, deadline - now) : 0;

  // timer update
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [started]);

  // waktu habis → munculkan modal selesai
  useEffect(() => {
    if (started && deadline && now >= deadline) {
      setShowFinish(true);
    }
  }, [now, started, deadline]);

  function handleStart() {
    setQuestions(Array.from({ length: 20 }, () => makeQuestion()));
    setDeadline(Date.now() + durationMin * 60 * 1000);
    setStarted(true);
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

    // kirim ke Neon lewat API
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    }).catch((err) => console.error("Gagal simpan ke DB", err));

    // reset
    setStarted(false);
    setQuestions([]);
    setDeadline(null);
    setShowFinish(false);
  }

  return (
    <div className="min-h-screen bg-white text-stone-900 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Tes Ganjil / Genap</h1>
          {!started && (
            <div className="flex gap-3">
              <Select value={String(durationMin)} onValueChange={(v) => setDurationMin(Number(v))}>
                <SelectTrigger className="w-[150px]">
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
              <Button onClick={handleStart}><Play className="w-4 h-4 mr-1" /> Mulai</Button>
            </div>
          )}
        </header>

        {/* Timer */}
        {started && (
          <div className="fixed right-4 top-4 z-40">
            <Card>
              <CardHeader><CardTitle className="flex gap-2 items-center"><Clock className="w-4 h-4" /> Timer</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${remainingMs < 15000 ? "text-red-600" : ""}`}>
                  {Math.floor(remainingMs / 1000)}s
                </div>
                <Progress value={(1 - remainingMs / (durationMin * 60 * 1000)) * 100} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Soal */}
        {started && (
          <Card>
            <CardContent>
              <div className="flex flex-col gap-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="border rounded-xl p-4">
                    <div className="flex items-center mb-3">
                      <span className="mr-3 font-semibold text-stone-500">{idx + 1}</span>
                      <span className="text-xl font-semibold">{q.a} + {q.b} =</span>
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

        {/* Modal Selesai */}
        {showFinish && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader><CardTitle>Selesai</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  <li><b>Terjawab:</b> {answeredCount}</li>
                  <li><b>Benar:</b> {correctCount}</li>
                  <li><b>Salah:</b> {wrongCount}</li>
                </ul>
                <div className="mt-4 flex justify-end">
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
