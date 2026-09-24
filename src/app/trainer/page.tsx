import type { Metadata } from "next";
import { PronunciationTrainer } from "@/components/trainer/pronunciation-trainer";

export const metadata: Metadata = {
  title: { absolute: "تدريب النطق" },
  description: "تدريب على نطق الحروف العربية",
  robots: { index: false, follow: false },
  openGraph: { title: "تدريب النطق", locale: "ar" },
};

export default function TrainerPage() {
  return <PronunciationTrainer />;
}
