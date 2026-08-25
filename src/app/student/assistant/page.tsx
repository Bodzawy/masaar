import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAiProvider } from "@/lib/ai/provider";
import { AssistantChat } from "@/components/student/assistant-chat";

export const metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  const session = await requireRole("STUDENT");
  const [progress, provider] = await Promise.all([
    db.studentProgress.findFirst({ where: { studentId: session.userId }, orderBy: { updatedAt: "desc" } }),
    getAiProvider(),
  ]);
  const level = progress?.levelCode ?? "A1";

  return (
    <div className="container max-w-3xl space-y-4 animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Learning Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">{provider.demoMode ? provider.name + " adapter — template replies grounded in your level (" + level + ")." : provider.name}</p>
        </div>
      </header>
      <AssistantChat level={level} />
    </div>
  );
}
