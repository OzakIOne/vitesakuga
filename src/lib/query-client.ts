import { QueryClient } from "@tanstack/react-query"

let _queryClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (!_queryClient) {
    _queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
        },
      },
    })
  }
  return _queryClient
}
