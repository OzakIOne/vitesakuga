import { describe, expect, it } from "vitest";

import { getSafeAuthRedirectUrl } from "./auth-redirect";

describe(getSafeAuthRedirectUrl, () => {
  it("allows the admin workspace as a sign-in return path", () => {
    expect(getSafeAuthRedirectUrl("/admin")).toBe("/admin");
  });

  it.each([
    "/admin/promotions",
    "/admin/reports",
    "/admin/roles",
    "/admin/storage",
    "/admin/suggestions",
  ])("allows the admin subroute %s", (path) => {
    expect(getSafeAuthRedirectUrl(path)).toBe(path);
  });

  it("preserves the search of an allowlisted admin path", () => {
    expect(getSafeAuthRedirectUrl("/admin/roles?tab=staff&page=2")).toBe(
      "/admin/roles?tab=staff&page=2",
    );
  });

  it("falls back for an unallowlisted admin path", () => {
    expect(getSafeAuthRedirectUrl("/admin/settings?tab=staff")).toBe("/");
  });

  it.each([
    "https://example.com/admin",
    "//example.com/admin",
    "/admin\\roles",
  ])("rejects unsafe return path %s", (path) => {
    expect(getSafeAuthRedirectUrl(path)).toBe("/");
  });
});
