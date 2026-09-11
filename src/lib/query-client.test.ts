import { describe, expect, it } from "vitest";

import { getQueryClient } from "./query-client";

describe("getQueryClient", () => {
  it("creates an isolated client for every server-side request", async () => {
    const first = getQueryClient();
    const second = getQueryClient();
    let secondQueryCalled = false;

    await first.fetchQuery({
      queryKey: ["query-client-isolation"],
      queryFn: async () => "first-request",
      staleTime: 60 * 60 * 1000,
    });
    const result = await second.fetchQuery({
      queryKey: ["query-client-isolation"],
      queryFn: async () => {
        secondQueryCalled = true;
        return "second-request";
      },
      staleTime: 60 * 60 * 1000,
    });

    expect(secondQueryCalled).toBe(true);
    expect(result).toBe("second-request");
  });
});
