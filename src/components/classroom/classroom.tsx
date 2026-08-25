"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, CameraOff, FileText, MessageSquare, Mic, MicOff, MonitorUp,
  PhoneOff, CircleDot, SignalHigh, Eraser, CheckSquare, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { endLesson } from "@/app/actions/session";

interface ChatMsg { id: number; from: "me" | "them"; text: string }
type SidePanel = "objectives" | "material" | "board";

export function Classroom({
  bookingId,
  role,
  selfName,
  selfColor,
  peerName,
  peerColor,
  lessonTitle,
  lessonMaterial,
  objectives,
  demoMode,
  providerName,
  postLessonHref,
}: {
  bookingId: string;
  role: "STUDENT" | "TEACHER";
  selfName: string;
  selfColor: string;
  peerName: string;
  peerColor: string;
  lessonTitle: string;
  lessonMaterial: { title: string; body: string | null } | null;
  objectives: Array<{ id: string; text: string }>;
  demoMode: boolean;
  providerName: string;
  postLessonHref: string;
}) {
  const router = useRouter();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenShare, setScreenShare] = useState(false);
  const [panel, setPanel] = useState<SidePanel>("objectives");
  const [chatOpen, setChatOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [consent, setConsent] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ending, setEnding] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([
    { id: 1, from: "them", text: `Hallo! Schön, dich zu sehen — lass uns mit „${lessonTitle}“ beginnen.` },
  ]);
  const [chatDraft, setChatDraft] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  // ── Whiteboard (local demo interaction) ────────────────────────────────────
  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#312E81";
    ctx.lineTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
    ctx.stroke();
  }, []);

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
  }
  function clearBoard() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function handleEnd() {
    setEnding(true);
    await endLesson(bookingId);
    router.push(postLessonHref);
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    setChat((c) => [...c, { id: Date.now(), from: "me", text: chatDraft.trim() }]);
    setChatDraft("");
  }

  return (
    <div className="flex h-dvh flex-col bg-[hsl(230_25%_10%)] text-white" role="region" aria-label="Live classroom">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{lessonTitle}</p>
          <p className="text-xs text-white/60">{role === "TEACHER" ? "Teaching" : "Learning"} · DeutschPath Live</p>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2.5 text-xs">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-mono tabular-nums" aria-label={`Elapsed time ${mmss}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> {mmss}
          </span>
          <Badge variant="outline" className="border-white/20 bg-transparent text-white/70 gap-1.5">
            <SignalHigh className="h-3 w-3" aria-hidden /> Good connection
          </Badge>
          <button
            type="button"
            onClick={() => setConsent((c) => !c)}
            aria-pressed={consent}
            title="Recording is never stored in demo mode"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              consent ? "bg-success/25 text-emerald-200" : "bg-white/10 text-white/60"
            )}
          >
            <CircleDot className={cn("h-3 w-3", consent && "animate-pulse")} aria-hidden />
            Recording consent: {consent ? "granted — nothing stored in demo" : "off"}
          </button>
        </div>
      </header>

      {demoMode && (
        <p className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">
          Local demo mode — video panels are simulated; no real media infrastructure ({providerName}) is connected.
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Video area */}
        <div className="relative min-h-[320px] flex-1 p-4">
          <div className={cn("grid h-full gap-4", screenShare ? "grid-rows-[1fr_auto]" : "grid-rows-2")}>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-950 to-slate-900 ring-1 ring-white/10">
              {screenShare ? (
                <div className="flex h-full items-center justify-center overflow-y-auto p-6">
                  <div className="w-full max-w-lg rounded-lg border border-white/15 bg-white p-5 text-slate-900 shadow-2xl animate-scale-in">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Screen share (simulated)</p>
                    <p className="mt-2 font-semibold">{lessonMaterial?.title ?? lessonTitle}</p>
                    <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-slate-600">
                      {lessonMaterial?.body ?? "Shared content would appear here."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <UserAvatar name={peerName} color={peerColor} className="h-24 w-24 text-2xl opacity-90" />
                </div>
              )}
              <span className="absolute bottom-3 left-3 rounded-md bg-black/50 px-2.5 py-1 text-xs font-medium backdrop-blur">
                {screenShare ? `${peerName} · screen` : peerName}
              </span>
            </div>
            <div className="relative min-h-[120px] overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 ring-1 ring-white/10">
              <div className="flex h-full items-center justify-center">
                {camOn ? (
                  <UserAvatar name={selfName} color={selfColor} className="h-16 w-16 text-lg opacity-80" />
                ) : (
                  <CameraOff className="h-8 w-8 text-white/30" aria-hidden />
                )}
              </div>
              <span className="absolute bottom-3 left-3 rounded-md bg-black/50 px-2.5 py-1 text-xs font-medium backdrop-blur">You</span>
              {!micOn && <span className="absolute top-3 right-3 rounded-md bg-destructive/90 px-2 py-1 text-[11px] font-medium">Mic off</span>}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <aside className="flex w-full shrink-0 flex-col border-t border-white/10 lg:w-96 lg:border-s lg:border-t-0">
          {!chatOpen ? (
            <>
              <div className="grid grid-cols-3 border-b border-white/10 text-xs font-medium" role="tablist" aria-label="Classroom panels">
                {(
                  [
                    ["objectives", role === "TEACHER" ? "Checklist" : "Objectives"],
                    ["material", "Material"],
                    ["board", "Board"],
                  ] as Array<[SidePanel, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={panel === key}
                    onClick={() => setPanel(key)}
                    className={cn(
                      "px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60",
                      panel === key ? "border-b-2 border-accent text-white" : "text-white/55 hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
                {panel === "objectives" && (
                  <section className="rounded-lg bg-white/5 p-3">
                    <ul className="space-y-1.5">
                      {objectives.map((o) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => setChecked((c) => ({ ...c, [o.id]: !c[o.id] }))}
                            className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-start hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                          >
                            {checked[o.id]
                              ? <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                              : <Square className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden />}
                            <span className={checked[o.id] ? "line-through opacity-60" : ""}>{o.text}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {panel === "material" && (
                  <section className="rounded-lg bg-white/5 p-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">{lessonMaterial?.title ?? "No materials"}</p>
                    <p className="whitespace-pre-line text-xs leading-relaxed text-white/75">{lessonMaterial?.body ?? "Materials appear here."}</p>
                  </section>
                )}

                {panel === "board" && (
                  <section className="rounded-lg bg-white/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Whiteboard</p>
                      <button type="button" onClick={clearBoard} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                        <Eraser className="h-3 w-3" aria-hidden /> Clear
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={560}
                      height={300}
                      onPointerDown={startDraw}
                      onPointerMove={draw}
                      onPointerUp={() => (drawing.current = false)}
                      onPointerLeave={() => (drawing.current = false)}
                      className="w-full touch-none cursor-crosshair rounded-md border border-white/15 bg-white"
                      aria-label="Whiteboard — draw with your pointer"
                    />
                    <p className="mt-1.5 text-[11px] text-white/40">Local demo board — strokes are not shared between participants.</p>
                  </section>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-48 flex-1 flex-col animate-fade-in">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 text-sm">
                {chat.map((m) => (
                  <div key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 leading-relaxed", m.from === "me" ? "ms-auto bg-primary" : "bg-white/10")}>
                    {m.text}
                  </div>
                ))}
              </div>
              <form onSubmit={sendChat} className="flex gap-2 border-t border-white/10 p-3">
                <Input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Message…"
                  aria-label="Chat message"
                  className="border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/60"
                />
                <Button type="submit" size="sm" variant="accent">Send</Button>
              </form>
            </div>
          )}

          {/* Panel toggle row for chat */}
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className="w-full rounded-md px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {chatOpen ? "Hide chat" : "Show chat"}
            </button>
          </div>
        </aside>
      </div>

      {/* Controls */}
      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <ControlBtn active={micOn} onClick={() => setMicOn((v) => !v)} label={micOn ? "Mute microphone" : "Unmute microphone"}>
          {micOn ? <Mic aria-hidden /> : <MicOff aria-hidden />}
          <span className="hidden sm:inline">{micOn ? "Mic" : "Mic off"}</span>
        </ControlBtn>
        <ControlBtn active={camOn} onClick={() => setCamOn((v) => !v)} label={camOn ? "Turn camera off" : "Turn camera on"}>
          {camOn ? <Camera aria-hidden /> : <CameraOff aria-hidden />}
          <span className="hidden sm:inline">Camera</span>
        </ControlBtn>
        <ControlBtn active={screenShare} onClick={() => setScreenShare((v) => !v)} label="Toggle screen share">
          <MonitorUp aria-hidden />
          <span className="hidden sm:inline">Share</span>
        </ControlBtn>
        <ControlBtn active={chatOpen} onClick={() => setChatOpen((v) => !v)} label="Toggle chat">
          <MessageSquare aria-hidden />
          <span className="hidden sm:inline">Chat</span>
        </ControlBtn>

        {role === "STUDENT" ? (
          <Button variant="destructive" className="ms-2" disabled={ending} onClick={handleEnd}>
            <PhoneOff aria-hidden /> {ending ? "Ending…" : "Leave & rate lesson"}
          </Button>
        ) : (
          <Button variant="success" className="ms-2" disabled={ending} onClick={handleEnd}>
            <CheckSquare aria-hidden /> {ending ? "Completing…" : "Mark lesson complete"}
          </Button>
        )}
      </footer>
    </div>
  );
}

function ControlBtn({ children, onClick, active, label }: { children: React.ReactNode; onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        active ? "bg-white/15 hover:bg-white/25" : "bg-destructive/80 hover:bg-destructive"
      )}
    >
      {children}
    </button>
  );
}
