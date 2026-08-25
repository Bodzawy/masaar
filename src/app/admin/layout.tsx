import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ADMIN_NAV } from "@/config/nav";
import { WorkspaceShell } from "@/components/shell/workspace-shell";

const ADMIN_ROLES = ["ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPPORT_ADMIN", "MODERATOR", "FINANCE_ADMIN", "SUPER_ADMIN"] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (!ADMIN_ROLES.includes(session.role as (typeof ADMIN_ROLES)[number])) redirect("/");
  const unread = await db.notification.count({ where: { userId: session.userId, readAt: null } });
  return (
    <WorkspaceShell role={session.role} items={ADMIN_NAV} userName={session.name} unreadCount={unread}>
      {children}
    </WorkspaceShell>
  );
}
