import { cn } from "@/lib/utils";

/** Detects Arabic-script characters (incl. diacritics/Harakat U+0610–U+06FF etc.). */
export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * RTL island for Arabic educational content inside the LTR German UI.
 * Renders with an educational Arabic typeface (Noto Naskh) and correct
 * directionality without affecting the surrounding document flow.
 */
export function ArabicText({
  children,
  className,
  as: Tag = "span",
  size = "base",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "p" | "div" | "h3" | "blockquote";
  size?: "sm" | "base" | "lg" | "xl";
}) {
  return (
    <Tag
      dir="rtl"
      lang="ar"
      className={cn(
        "font-arabic leading-relaxed",
        size === "sm" && "text-sm",
        size === "base" && "text-base",
        size === "lg" && "text-xl",
        size === "xl" && "text-2xl sm:text-3xl",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Mixed-direction wrapper: renders German/Arabic mixed strings with
 * per-segment direction so punctuation and word order stay stable.
 * Splits on line breaks; each line gets dir="auto".
 */
export function MixedText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={cn("space-y-2", className)}>
      {lines.map((line, i) =>
        containsArabic(line) ? (
          <p key={i} dir="auto" lang={containsArabic(line) ? "ar" : "de"} className={cn(containsArabic(line) && "font-arabic")}>
            {line}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {line}
          </p>
        )
      )}
    </div>
  );
}
