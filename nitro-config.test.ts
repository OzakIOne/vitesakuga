import { describe, expect, it, vi } from "vitest";

const imgSrc = (csp: string) => csp.split("img-src ")[1]!.split("; ")[0]!;

describe("nitro CSP", () => {
  it("allows the Turnstile script and widget iframe", async () => {
    const nitroConfig = await import("./nitro.config");
    const csp = (
      nitroConfig.default.routeRules as Record<
        string,
        { headers: Record<string, string> }
      >
    )["/**"]!.headers["content-security-policy"]!;
    expect(csp).toContain(
      "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com",
    );
    expect(csp).toContain("frame-src 'self' https://challenges.cloudflare.com");
    expect(imgSrc(csp)).toBe("'self' data: blob: https:");
  });

  it("keeps the Turnstile origin in the production script-src hash allowlist", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.resetModules();
    const nitroConfig = await import("./nitro.config");
    const csp = (
      nitroConfig.default.routeRules as Record<
        string,
        { headers: Record<string, string> }
      >
    )["/**"]!.headers["content-security-policy"]!;
    expect(csp).toContain(
      "script-src 'self' 'wasm-unsafe-eval' 'sha256-gb6dNSVZKu5ARVoUjTW1x8JnToWeIcP2K0lB6J49wPA=' https://challenges.cloudflare.com",
    );
    expect(imgSrc(csp)).toBe("'self' data: blob: https:");
    vi.unstubAllEnvs();
  });
});
