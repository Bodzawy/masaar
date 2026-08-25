"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSwitcher({ current }: { current: string }) {
  const [pending, start] = useTransition();
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        start(async () => {
          await fetch("/api/locale", { method: "POST", body: JSON.stringify({ locale: v }) });
          window.location.reload();
        });
      }}
    >
      <SelectTrigger className="h-8 w-[130px]" aria-label="Language" disabled={pending}>
        <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="ar">العربية</SelectItem>
      </SelectContent>
    </Select>
  );
}
