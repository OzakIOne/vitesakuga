import { loadInfraEnv } from "./defs";

/**
 * Process-wide snapshot of the boot-time infrastructure flags. Read once at
 * module load — the same moment the previous ad-hoc `process.env` reads
 * happened — so driver selection, tracing setup, and seeding behave
 * identically. Deliberately separate from `env/server.ts`, which validates
 * every app secret at import time and must not enter infrastructure import
 * graphs (tracing, test layers).
 */
export const envInfra = loadInfraEnv();
