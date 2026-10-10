import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import {
  useChangePassword,
  useDeleteAccount,
  useResendEmailVerification,
  useLogin,
  useSignUp,
  useSocialLogin,
  useUpdateProfile,
  useVerifyEmail,
} from "./auth.hooks";
import { AuthClientContext } from "./client-context";
import { getTwoFactorRedirectUrl } from "./two-factor.hooks";

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
  signIn: {
    email: vi.fn(),
    social: vi.fn(),
  },
  signUp: {
    email: vi.fn(),
  },
  emailOtp: {
    sendVerificationOtp: vi.fn(),
    verifyEmail: vi.fn(),
  },
  updateUser: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
});

vi.mock("./delete-account", () => ({
  deleteAccount: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  )),
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

describe(useLogin, () => {
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

  it("calls signIn.email with credentials", async () => {
    mockAuth.signIn.email.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useLogin("/account"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ email: "a@b.com", password: "secret" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signIn.email).toHaveBeenCalledWith(
      { email: "a@b.com", password: "secret", callbackURL: "/account" },
      expect.any(Object),
    );
  });

  it("keeps the safe redirect when password sign-in returns a 2FA challenge", async () => {
    const challenge = {
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    };
    mockAuth.signIn.email.mockImplementationOnce(async (_input, options) => {
      await options?.onSuccess?.({ data: challenge });
      return { data: challenge, error: null };
    });
    const { result } = await renderHook(() => useLogin("https://evil.test"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ email: "a@b.com", password: "secret" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signIn.email).toHaveBeenCalledWith(
      { email: "a@b.com", password: "secret", callbackURL: "/" },
      expect.any(Object),
    );
    expect(getTwoFactorRedirectUrl()).toBe("/");
    expect(authNavigation.events).toEqual([]);
    expect(authNavigation.navigate).not.toHaveBeenCalled();
  });

  it("clears a saved 2FA redirect after password sign-in fails", async () => {
    mockAuth.signIn.email.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid credentials" },
    });
    const { result } = await renderHook(() => useLogin("/account"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ email: "a@b.com", password: "wrong" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(getTwoFactorRedirectUrl()).toBe("/");
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
    authNavigation.events.length = 0;
    authNavigation.navigate.mockClear();
    globalThis.sessionStorage.clear();
  });

  it("calls signUp.email with user details", async () => {
    mockAuth.signUp.email.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useSignUp("/account"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ name: "Alice", email: "a@b.com", password: "pw" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.signUp.email).toHaveBeenCalledWith(
      {
        name: "Alice",
        email: "a@b.com",
        password: "pw",
        callbackURL: "/account",
      },
      expect.any(Object),
    );
  });
});

describe("email verification hooks", () => {
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

  it("verifies the signup code", async () => {
    mockAuth.emailOtp.verifyEmail.mockResolvedValueOnce({ data: {} });
    const { result } = await renderHook(() => useVerifyEmail("/account"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ email: "alice@gmail.com", otp: "123456" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.emailOtp.verifyEmail).toHaveBeenCalledWith({
      email: "alice@gmail.com",
      otp: "123456",
    });
  });

  it("keeps the redirect when email verification returns a 2FA challenge", async () => {
    mockAuth.emailOtp.verifyEmail.mockResolvedValueOnce({
      data: {
        twoFactorRedirect: true,
        twoFactorMethods: ["totp"],
      },
      error: null,
    });
    const { result } = await renderHook(() => useVerifyEmail("/account"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ email: "alice@gmail.com", otp: "123456" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getTwoFactorRedirectUrl()).toBe("/account");
    expect(authNavigation.navigate).not.toHaveBeenCalled();
  });

  it("resends the signup code", async () => {
    mockAuth.emailOtp.sendVerificationOtp.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useResendEmailVerification(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ email: "alice@gmail.com" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: "alice@gmail.com",
      type: "email-verification",
    });
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

  it("calls updateUser with name, username and image", async () => {
    mockAuth.updateUser.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({
      name: "Bob",
      image: "https://example.com/avatar.jpg",
      username: "bob",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      name: "Bob",
      image: "https://example.com/avatar.jpg",
      username: "bob",
    });
  });

  it("shows error toast on failure", async () => {
    mockAuth.updateUser.mockRejectedValueOnce(new Error("Validation error"));
    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ name: "Bob", image: "", username: "bob" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error updating profile" }),
    );
  });

  it("shows success toast on success", async () => {
    mockAuth.updateUser.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ name: "Bob", image: "", username: "bob" });
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
    const { result } = await renderHook(() => useChangePassword(), {
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
    const { result } = await renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ currentPassword: "old", newPassword: "new" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error changing password" }),
    );
  });

  it("surfaces Better Auth errors returned from changing the password", async () => {
    mockAuth.changePassword.mockResolvedValueOnce({
      error: { message: "Invalid current password" },
    });
    const { result } = await renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({
      currentPassword: "wrong-password",
      newPassword: "new-password",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      message: "Invalid current password",
    });
  });

  it("shows success toast on success", async () => {
    mockAuth.changePassword.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useChangePassword(), {
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

  it("calls deleteAccount with the password then signs out", async () => {
    const { deleteAccount } = await import("./delete-account");
    vi.mocked(deleteAccount).mockResolvedValueOnce({ deletedUserId: "u1" });
    mockAuth.signOut.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ password: "secret" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(deleteAccount).toHaveBeenCalledWith({
      data: { password: "secret" },
    });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it("calls deleteAccount without a password for passwordless accounts", async () => {
    const { deleteAccount } = await import("./delete-account");
    vi.mocked(deleteAccount).mockResolvedValueOnce({ deletedUserId: "u1" });
    mockAuth.signOut.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ password: undefined });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(deleteAccount).toHaveBeenCalledWith({ data: {} });
  });

  it("shows error toast on failure", async () => {
    const { deleteAccount } = await import("./delete-account");
    vi.mocked(deleteAccount).mockRejectedValueOnce(
      new Error("Incorrect password"),
    );
    const { result } = await renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ password: "wrong" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error deleting account" }),
    );
  });

  it("shows success toast on success", async () => {
    const { deleteAccount } = await import("./delete-account");
    vi.mocked(deleteAccount).mockResolvedValueOnce({ deletedUserId: "u1" });
    mockAuth.signOut.mockResolvedValueOnce({});
    const { result } = await renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    result.current.mutate({ password: undefined });
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
    const { result } = await renderHook(() => useSocialLogin("/account"), {
      wrapper: createWrapper(queryClient, mockAuth),
    });

    await result.current("github");

    expect(mockAuth.signIn.social).toHaveBeenCalledWith(
      { provider: "github", callbackURL: "/account" },
      expect.any(Object),
    );
  });
});
