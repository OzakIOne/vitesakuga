// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthClientContext } from "./client-context";
import {
  useDisableTwoFactor,
  useEnableTwoFactor,
  useGenerateBackupCodes,
  useVerifyBackupCode,
  useVerifyTotp,
} from "./two-factor.hooks";

const createMockAuthClient = () => ({
  twoFactor: {
    disable: vi.fn(),
    enable: vi.fn(),
    generateBackupCodes: vi.fn(),
    verifyBackupCode: vi.fn(),
    verifyTotp: vi.fn(),
  },
});

vi.mock("@tanstack/react-router", () => ({
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

describe(useEnableTwoFactor, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("enables TOTP without a password for passwordless (OAuth-only) users", async () => {
    mockAuth.twoFactor.enable.mockResolvedValueOnce({
      data: { method: "totp" },
      error: null,
    });
    const { result } = renderHook(() => useEnableTwoFactor(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.twoFactor.enable).toHaveBeenCalledWith({
      password: "",
      method: "totp",
    });
  });

  it("sends the password when the user has one", async () => {
    mockAuth.twoFactor.enable.mockResolvedValueOnce({
      data: { method: "totp" },
      error: null,
    });
    const { result } = renderHook(() => useEnableTwoFactor(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ password: "secret" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.twoFactor.enable).toHaveBeenCalledWith({
      password: "secret",
      method: "totp",
    });
  });
});

describe(useDisableTwoFactor, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("disables 2FA without a password for passwordless (OAuth-only) users", async () => {
    mockAuth.twoFactor.disable.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });
    const { result } = renderHook(() => useDisableTwoFactor(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.twoFactor.disable).toHaveBeenCalledWith({ password: "" });
  });
});

describe(useGenerateBackupCodes, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("regenerates backup codes without a password for passwordless users", async () => {
    mockAuth.twoFactor.generateBackupCodes.mockResolvedValueOnce({
      data: { backupCodes: ["aaaa-aaaa", "bbbb-bbbb"] },
      error: null,
    });
    const { result } = renderHook(() => useGenerateBackupCodes(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.twoFactor.generateBackupCodes).toHaveBeenCalledWith({
      password: "",
    });
  });
});

describe(useVerifyTotp, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("verifies a TOTP code with device trust", async () => {
    mockAuth.twoFactor.verifyTotp.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });
    const { result } = renderHook(() => useVerifyTotp(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ code: "123456", trustDevice: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.twoFactor.verifyTotp).toHaveBeenCalledWith({
      code: "123456",
      trustDevice: true,
    });
  });

  it("verifies a TOTP code without trusting the device", async () => {
    mockAuth.twoFactor.verifyTotp.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });
    const { result } = renderHook(() => useVerifyTotp(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ code: "654321" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.twoFactor.verifyTotp).toHaveBeenCalledWith({
      code: "654321",
      trustDevice: undefined,
    });
  });
});

describe(useVerifyBackupCode, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("verifies a backup code", async () => {
    mockAuth.twoFactor.verifyBackupCode.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });
    const { result } = renderHook(() => useVerifyBackupCode(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ code: "aaaa-bbbb" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.twoFactor.verifyBackupCode).toHaveBeenCalledWith({
      code: "aaaa-bbbb",
      trustDevice: undefined,
    });
  });
});
