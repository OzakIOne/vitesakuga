/// <reference types="vite/client" />

type ViteTypeOptions = {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- Vite augments this global interface; a type alias cannot merge with vite/client.
interface ImportMetaEnv {
  readonly VITE_BASE_URL: string;
  readonly VITE_CLOUDFLARE_R2_PUBLIC_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_TURNSTILE_REQUIRED: string;
  readonly VITE_TURNSTILE_SITEKEY: string;
  // more env variables...
}

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
