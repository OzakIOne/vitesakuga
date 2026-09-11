import { QueryClient } from "@tanstack/react-query";

export const QUERY_STALE_TIME = 5 * 60 * 1000;
export const QUERY_GC_TIME = 30 * 60 * 1000;

const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: QUERY_GC_TIME,
        staleTime: QUERY_STALE_TIME,
      },
    },
  });

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (!globalThis.document) {
    return createQueryClient();
  }

  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}
