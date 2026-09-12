import { loadClientEnv } from "./defs";

const baseClientEnvSource = {
  BASE_URL: import.meta.env.BASE_URL,
  DEV: import.meta.env.DEV,
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  SSR: import.meta.env.SSR,
  VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  VITE_TURNSTILE_REQUIRED: import.meta.env.VITE_TURNSTILE_REQUIRED,
  VITE_TURNSTILE_SITEKEY: import.meta.env.VITE_TURNSTILE_SITEKEY,
};

const clientEnvSource = import.meta.env.DEV
  ? {
      ...baseClientEnvSource,
      VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
      VITE_CLOUDFLARE_R2_PUBLIC_URL: import.meta.env
        .VITE_CLOUDFLARE_R2_PUBLIC_URL,
    }
  : baseClientEnvSource;

export const envClient = loadClientEnv(clientEnvSource);
