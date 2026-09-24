// Keep in sync with TRAINER_HOST in next.config.mjs.
const TRAINER_HOSTS = new Set(["dev.dz2s.de"]);

export function isTrainerHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return TRAINER_HOSTS.has(host.split(":")[0]!.trim().toLowerCase());
}
