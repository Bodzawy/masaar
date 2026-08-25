import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { STUDENT_NAV } from "@/config/nav";
import { WorkspaceShell } from "@/components/shell/workspace-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (session.role !== "STUDENT") redirect("/");

  const unread = await db.notification.count({ where: { userId: session.userId, readAt: null } });

  return (
    <WorkspaceShell role="STUDENT" items={STUDENT_NAV} userName={session.name} unreadCount={unread}>
      {children}
    </WorkspaceShell>
  );
}
