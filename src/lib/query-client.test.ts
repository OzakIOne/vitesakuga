import { describe, expect, it } from "vitest";

import {
  getQueryClient,
  QUERY_GC_TIME,
  QUERY_STALE_TIME,
} from "./query-client";

describe("getQueryClient", () => {
  it("keeps query data fresh for five minutes and cached for thirty", () => {
    const queryClient = getQueryClient();
    const defaults = queryClient.getDefaultOptions().queries;

    expect(defaults?.staleTime).toBe(QUERY_STALE_TIME);
    expect(defaults?.gcTime).toBe(QUERY_GC_TIME);
  });

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
