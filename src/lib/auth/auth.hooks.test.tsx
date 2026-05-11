// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useChangePassword,
  useDeleteAccount,
  useLogin,
  useSignUp,
  useSocialLogin,
  useUpdateProfile,
} from "./auth.hooks";
import { AuthClientContext } from "./client-context";

const createMockAuthClient = () => ({
  signIn: {
    email: vi.fn(),
    social: vi.fn(),
  },
  signUp: {
    email: vi.fn(),
  },
  updateUser: vi.fn(),
  changePassword: vi.fn(),
  deleteUser: vi.fn(),
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

describe(useLogin, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("calls signIn.email with credentials", async () => {
    mockAuth.signIn.email.mockResolvedValueOnce({});
    const { result } = renderHook(() => useLogin("/dashboard"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ email: "a@b.com", password: "secret" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signIn.email).toHaveBeenCalledWith(
      { email: "a@b.com", password: "secret", callbackURL: "/dashboard" },
      expect.any(Object),
    );
  });
});

describe(useSignUp, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("calls signUp.email with user details", async () => {
    mockAuth.signUp.email.mockResolvedValueOnce({});
    const { result } = renderHook(() => useSignUp("/welcome"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ name: "Alice", email: "a@b.com", password: "pw" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signUp.email).toHaveBeenCalledWith(
      {
        name: "Alice",
        email: "a@b.com",
        password: "pw",
        callbackURL: "/welcome",
      },
      expect.any(Object),
    );
  });
});

describe(useUpdateProfile, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("calls updateUser with name and image", async () => {
    mockAuth.updateUser.mockResolvedValueOnce({});
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({
      name: "Bob",
      image: "https://example.com/avatar.jpg",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      name: "Bob",
      image: "https://example.com/avatar.jpg",
    });
  });

  it("shows error toast on failure", async () => {
    mockAuth.updateUser.mockRejectedValueOnce(new Error("Validation error"));
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ name: "Bob", image: "" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error updating profile" }),
    );
  });

  it("shows success toast on success", async () => {
    mockAuth.updateUser.mockResolvedValueOnce({});
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ name: "Bob", image: "" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Profile updated" }),
    );
  });
});

describe(useChangePassword, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("calls changePassword with old and new password", async () => {
    mockAuth.changePassword.mockResolvedValueOnce({});
    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ currentPassword: "old", newPassword: "new" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.changePassword).toHaveBeenCalledWith({
      currentPassword: "old",
      newPassword: "new",
      revokeOtherSessions: true,
    });
  });

  it("shows error toast on failure", async () => {
    mockAuth.changePassword.mockRejectedValueOnce(new Error("Wrong password"));
    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ currentPassword: "old", newPassword: "new" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error changing password" }),
    );
  });

  it("shows success toast on success", async () => {
    mockAuth.changePassword.mockResolvedValueOnce({});
    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ currentPassword: "old", newPassword: "new" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password updated" }),
    );
  });
});

describe(useDeleteAccount, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("calls deleteUser", async () => {
    mockAuth.deleteUser.mockResolvedValueOnce({});
    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.deleteUser).toHaveBeenCalled();
  });

  it("shows error toast on failure", async () => {
    mockAuth.deleteUser.mockRejectedValueOnce(new Error("Cannot delete"));
    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error deleting account" }),
    );
  });

  it("shows success toast on success", async () => {
    mockAuth.deleteUser.mockResolvedValueOnce({});
    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Account deleted" }),
    );
  });
});

describe(useSocialLogin, () => {
  let queryClient: QueryClient;
  let mockAuth: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAuth = createMockAuthClient();
  });

  it("calls signIn.social with provider", async () => {
    mockAuth.signIn.social.mockResolvedValueOnce({});
    const { result } = renderHook(() => useSocialLogin("/dashboard"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    await result.current("github");

    expect(mockAuth.signIn.social).toHaveBeenCalledWith(
      { provider: "github", callbackURL: "/dashboard" },
      expect.any(Object),
    );
  });
});
