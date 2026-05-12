import { envClient } from "../env/client";

export const assetUrl = (key: string) => {
  const base = envClient.VITE_CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, "");
  const path = key.replace(/^\/+/, "");
  return `${base}/${path}`;
};
