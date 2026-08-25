import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TEACHER_NAV } from "@/config/nav";
import { WorkspaceShell } from "@/components/shell/workspace-shell";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (session.role !== "TEACHER") redirect("/");
  const unread = await db.notification.count({ where: { userId: session.userId, readAt: null } });
  return (
    <WorkspaceShell role="TEACHER" items={TEACHER_NAV} userName={session.name} unreadCount={unread}>
      {children}
    </WorkspaceShell>
  );
}
