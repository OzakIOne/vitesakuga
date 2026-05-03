/// <reference types="vite/client" />

type ViteTypeOptions = {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  // strictImportMetaEnv: unknown
};

type ImportMetaEnv = {
  readonly VITE_BASE_URL: string;
  // more env variables...
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
