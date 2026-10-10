import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import {
  useAddPasskey,
  useDeletePasskey,
  usePasskeys,
  useRenamePasskey,
  useSignInWithPasskey,
} from "./auth.hooks";
import { AuthClientContext } from "./client-context";
import { getTwoFactorRedirectUrl } from "./two-factor.hooks";
import { useSignInCompletion } from "./use-sign-in-completion";

const authNavigation = vi.hoisted(() => {
  const events = new Array<string>();
  return {
    events,
    navigate: vi.fn(async (_destination: { to: string }) => {
      events.push("navigate");
    }),
  };
});

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

vi.mock("./client", () => ({
  default: {
    passkey: {
      listUserPasskeys: vi.fn(),
      addPasskey: vi.fn(),
      updatePasskey: vi.fn(),
      deletePasskey: vi.fn(),
    },
    signIn: {
      passkey: vi.fn(),
    },
  },
}));

vi.mock("./delete-account", () => ({
  deleteAccount: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  isRedirect: () => false,
  useNavigate: () => authNavigation.navigate,
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock("src/components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

vi.mock("src/lib/users/users.queries", () => ({
  usersKeys: { userInfo: ["userInfo"] },
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

const waitFor = vi.waitFor;

describe(usePasskeys, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
    authNavigation.events.length = 0;
    authNavigation.navigate.mockClear();
    globalThis.sessionStorage.clear();
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
    const { result } = await renderHook(() => usePasskeys(), {
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
    const { result } = await renderHook(() => usePasskeys(), {
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
    const { result } = await renderHook(() => usePasskeys(), {
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
    const { result } = await renderHook(() => useAddPasskey(), {
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
    const { result } = await renderHook(() => useAddPasskey(), {
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
    const { result } = await renderHook(() => useRenamePasskey(), {
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
    const { result } = await renderHook(() => useDeletePasskey(), {
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
    authNavigation.events.length = 0;
    authNavigation.navigate.mockClear();
    globalThis.sessionStorage.clear();
  });

  it("starts a passkey sign-in without autofill", async () => {
    mockAuth.signIn.passkey.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { result } = await renderHook(
      () => useSignInWithPasskey("/account"),
      {
        wrapper: createWrapper(queryClient, mockAuth),
      },
    );

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signIn.passkey).toHaveBeenCalledWith({});
  });

  it("passes autofill through to the browser ceremony", async () => {
    mockAuth.signIn.passkey.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { result } = await renderHook(() => useSignInWithPasskey("/"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ autoFill: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signIn.passkey).toHaveBeenCalledWith({ autoFill: true });
  });

  it("invalidates the user session before navigating after passkey sign-in", async () => {
    mockAuth.signIn.passkey.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    queryClient.setQueryData(["userInfo"], { id: "previous-user" });
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "invalidate") {
        authNavigation.events.push("invalidate");
      }
    });
    const { result } = await renderHook(
      () => useSignInWithPasskey("/account"),
      { wrapper: createWrapper(queryClient, mockAuth) },
    );

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    unsubscribe();

    expect(authNavigation.events).toEqual(["invalidate", "navigate"]);
    expect(authNavigation.navigate).toHaveBeenCalledWith({ to: "/account" });
    expect(getTwoFactorRedirectUrl()).toBe("/");
  });

  it("retains the redirect and skips navigation for a passkey 2FA challenge", async () => {
    mockAuth.signIn.passkey.mockResolvedValueOnce({
      data: {
        twoFactorRedirect: true,
        twoFactorMethods: ["totp"],
      },
      error: null,
    });
    const { result } = await renderHook(
      () => useSignInWithPasskey("/account"),
      { wrapper: createWrapper(queryClient, mockAuth) },
    );

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getTwoFactorRedirectUrl()).toBe("/account");
    expect(authNavigation.navigate).not.toHaveBeenCalled();
  });

  it("clears the redirect when passkey sign-in fails", async () => {
    mockAuth.signIn.passkey.mockResolvedValueOnce({
      data: null,
      error: { message: "No matching passkey" },
    });
    const { result } = await renderHook(
      () => useSignInWithPasskey("/dashboard"),
      { wrapper: createWrapper(queryClient, mockAuth) },
    );

    result.current.mutate({});
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(getTwoFactorRedirectUrl()).toBe("/");
    expect(authNavigation.navigate).not.toHaveBeenCalled();
  });

  it("keeps completion callbacks stable across renders for conditional passkey", async () => {
    const { result, rerender } = await renderHook(
      () => useSignInCompletion("/dashboard"),
      { wrapper: createWrapper(queryClient, mockAuth) },
    );
    const initialCompletion = result.current;

    rerender();

    expect(result.current).toBe(initialCompletion);
  });
});
