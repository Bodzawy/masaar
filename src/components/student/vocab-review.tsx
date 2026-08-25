"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, ThumbsUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { reviewVocab } from "@/app/actions/vocabulary";

export interface VocabCard {
  reviewId: string;
  word: string;
  translationEn: string;
  exampleDe: string;
  exampleEn: string;
  partOfSpeech: string;
  box: number;
  dueToday: boolean;
}

export function VocabReview({ items }: { items: VocabCard[] }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center p-10 text-center">
          <Check className="h-8 w-8 text-success" aria-hidden />
          <p className="mt-3 font-medium">Nothing due — you are all caught up!</p>
          <p className="mt-1 text-sm text-muted-foreground">New words from your lessons will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.reviewId}>
          <Card className={cn("h-full transition-opacity", done[item.reviewId] && "opacity-50")}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{item.word}</p>
                  <p className="text-xs italic text-muted-foreground">{item.partOfSpeech}</p>
                </div>
                {item.dueToday ? <Badge variant="accent">Due today</Badge> : <Badge variant="muted">Box {item.box}</Badge>}
              </div>

              {revealed[item.reviewId] ? (
                <div className="mt-3 animate-fade-in">
                  <p className="font-medium text-primary">{item.translationEn}</p>
                  <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">{item.exampleDe}</p>
                  <p className="mt-1 px-1 text-xs text-muted-foreground">{item.exampleEn}</p>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setRevealed((r) => ({ ...r, [item.reviewId]: true }))}>
                  Show meaning
                </Button>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={done[item.reviewId]}
                  onClick={() => {
                    setDone((d) => ({ ...d, [item.reviewId]: true }));
                    start(async () => { await reviewVocab(item.reviewId, "again"); });
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <RotateCcw aria-hidden /> Again
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={done[item.reviewId]}
                  onClick={() => {
                    setDone((d) => ({ ...d, [item.reviewId]: true }));
                    start(async () => { await reviewVocab(item.reviewId, "good"); });
                  }}
                >
                  <ThumbsUp aria-hidden /> Good
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  disabled={done[item.reviewId]}
                  onClick={() => {
                    setDone((d) => ({ ...d, [item.reviewId]: true }));
                    start(async () => { await reviewVocab(item.reviewId, "easy"); });
                  }}
                >
                  <Zap aria-hidden /> Easy
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
