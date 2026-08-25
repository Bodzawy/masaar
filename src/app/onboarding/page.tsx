import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (session.role !== "STUDENT") redirect("/");
  return (
    <main className="container py-12">
      <OnboardingWizard name={session.name} />
    </main>
  );
}
