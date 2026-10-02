export const E2E_POSTGRES_PORT =
  process.env["VITESAKUGA_E2E_POSTGRES_PORT"] ?? "15432";

export const E2E_DATABASE_URL = `postgresql://user:password@localhost:${E2E_POSTGRES_PORT}/sakuga?sslmode=disable`;
