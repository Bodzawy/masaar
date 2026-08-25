"use client";

import { useRef, useState, useTransition } from "react";
import { Bot, Loader2, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function AssistantChat({ level }: { level: string }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: `Hallo! I'm your learning assistant. You're working at ${level} — ask me about grammar topics, your current lesson, or how to prepare for exams.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    start(async () => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => null);
      setMessages((m) => [...m, { role: "assistant", content: data?.reply ?? "(The assistant is unavailable right now.)" }]);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    });
  }

  return (
    <Card className="flex h-[70vh] flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-primary text-white" : "bg-accent/20 text-accent-foreground"}`}>
              {m.role === "user" ? <User className="h-3.5 w-3.5" aria-hidden /> : <Bot className="h-3.5 w-3.5" aria-hidden />}
            </span>
            <p className={`max-w-[80%] whitespace-pre-line rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-white" : "border border-border bg-card"}`}>
              {m.content}
            </p>
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Thinking…
          </div>
        )}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about grammar, your lesson or study tips…" aria-label="Message the assistant" />
        <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label="Send"><Send aria-hidden /></Button>
      </form>
    </Card>
  );
}

export function DemoBadge() {
  return <Badge variant="accent">Demo responses</Badge>;
}
