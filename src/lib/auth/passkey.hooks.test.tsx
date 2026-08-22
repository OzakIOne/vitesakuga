// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAddPasskey,
  useDeletePasskey,
  usePasskeys,
  useRenamePasskey,
  useSignInWithPasskey,
} from "./auth.hooks";
import { AuthClientContext } from "./client-context";

const createMockAuthClient = () => ({
  passkey: {
    listUserPasskeys: vi.fn(),
    addPasskey: vi.fn(),
    updatePasskey: vi.fn(),
    deletePasskey: vi.fn(),
  },
  signIn: {
    passkey: vi.fn(),
  },
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock("src/components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

const createWrapper = (
  queryClient: QueryClient,
  authClient: ReturnType<typeof createMockAuthClient>,
) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthClientContext.Provider
        value={authClient as unknown as typeof import("./client").default}
      >
        {children}
      </AuthClientContext.Provider>
    </QueryClientProvider>
  );
};

describe(usePasskeys, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("loads the user's passkeys", async () => {
    const passkeys = [
      {
        id: "passkey-1",
        name: "MacBook Touch ID",
        createdAt: new Date("2026-01-01"),
      },
    ];
    mockAuth.passkey.listUserPasskeys.mockResolvedValueOnce({
      data: passkeys,
      error: null,
    });
    const { result } = renderHook(() => usePasskeys(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAuth.passkey.listUserPasskeys).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(passkeys);
  });

  it("falls back to an empty list when the API returns no data", async () => {
    mockAuth.passkey.listUserPasskeys.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const { result } = renderHook(() => usePasskeys(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("surfaces API errors", async () => {
    mockAuth.passkey.listUserPasskeys.mockResolvedValueOnce({
      data: null,
      error: { message: "Failed to list passkeys" },
    });
    const { result } = renderHook(() => usePasskeys(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("Failed to list passkeys"));
  });
});

describe(useAddPasskey, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("adds a passkey with an optional name", async () => {
    mockAuth.passkey.addPasskey.mockResolvedValueOnce({
      data: { id: "passkey-1" },
      error: null,
    });
    const { result } = renderHook(() => useAddPasskey(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ name: "MacBook Touch ID" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.passkey.addPasskey).toHaveBeenCalledWith({
      name: "MacBook Touch ID",
    });
  });

  it("adds a passkey without a name", async () => {
    mockAuth.passkey.addPasskey.mockResolvedValueOnce({
      data: { id: "passkey-1" },
      error: null,
    });
    const { result } = renderHook(() => useAddPasskey(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.passkey.addPasskey).toHaveBeenCalledWith({});
  });
});

describe(useRenamePasskey, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("renames a passkey", async () => {
    mockAuth.passkey.updatePasskey.mockResolvedValueOnce({
      data: { id: "passkey-1", name: "New name" },
      error: null,
    });
    const { result } = renderHook(() => useRenamePasskey(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ id: "passkey-1", name: "New name" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.passkey.updatePasskey).toHaveBeenCalledWith({
      id: "passkey-1",
      name: "New name",
    });
  });
});

describe(useDeletePasskey, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("deletes a passkey", async () => {
    mockAuth.passkey.deletePasskey.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });
    const { result } = renderHook(() => useDeletePasskey(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ id: "passkey-1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.passkey.deletePasskey).toHaveBeenCalledWith({
      id: "passkey-1",
    });
  });
});

describe(useSignInWithPasskey, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("starts a passkey sign-in without autofill", async () => {
    mockAuth.signIn.passkey.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { result } = renderHook(() => useSignInWithPasskey("/dashboard"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signIn.passkey).toHaveBeenCalledWith({});
  });

  it("passes autofill through to the browser ceremony", async () => {
    mockAuth.signIn.passkey.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { result } = renderHook(() => useSignInWithPasskey("/"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ autoFill: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signIn.passkey).toHaveBeenCalledWith({ autoFill: true });
  });
});
