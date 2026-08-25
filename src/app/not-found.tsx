import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-bold text-primary/20">404</p>
      <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The page you are looking for does not exist or you do not have access to it.
      </p>
      <Button className="mt-6" asChild><Link href="/">Back to {brand.name}</Link></Button>
    </main>
  );
}
