import { execSync } from "node:child_process";

// Deterministic starting state for the happy path.
export default function globalSetup() {
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", cwd: process.cwd(), env: process.env });
}
