// The demo-account selector must be impossible to expose in production:
// it requires NODE_ENV !== "production" AND DEMO_MODE === "true".
export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true";
}
