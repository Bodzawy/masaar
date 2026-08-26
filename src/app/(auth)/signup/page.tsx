import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeForRole } from "@/lib/routing";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata = { title: "Konto erstellen" };

export default async function SignUpPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">D</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Starte deine Arabisch-Reise</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ein strukturierter Weg von A1 bis C2 – mit echten Lehrkräften.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <SignUpForm />
        </div>
      </div>
    </main>
  );
}
