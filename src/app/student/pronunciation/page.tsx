import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PronunciationTest from "../../pronunciation-test/page";

export default function StudentPronunciationPage() {
  return (
    <div className="space-y-4">

      <Link
        href="/student"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </Link>

      <PronunciationTest />

    </div>
  );
}