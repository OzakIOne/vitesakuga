import { QueryClient } from "@tanstack/react-query";

const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
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
