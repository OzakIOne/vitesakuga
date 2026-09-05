// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AuthClientContext } from "src/lib/auth/client-context";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TwoFactorSection } from "./TwoFactorSection";

// Ark UI's dialog machine observes element size changes; happy-dom does not
// ship a ResizeObserver, so provide a no-op implementation.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

const createMockAuthClient = () => ({
  twoFactor: {
    disable: vi.fn(),
    enable: vi.fn(),
    generateBackupCodes: vi.fn(),
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
        value={
          authClient as unknown as typeof import("../lib/auth/client").default
        }
      >
        {children}
      </AuthClientContext.Provider>
    </QueryClientProvider>
  );
};

afterEach(() => cleanup());

const renderSection = ({
  authClient,
  email = "alice@test.com",
  enabled = false,
  hasPassword,
}: {
  authClient: ReturnType<typeof createMockAuthClient>;
  email?: string;
  enabled?: boolean;
  hasPassword: boolean;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <TwoFactorSection
      email={email}
      enabled={enabled}
      hasPassword={hasPassword}
    />,
    {
      wrapper: createWrapper(queryClient, authClient),
    },
  );
  return { queryClient };
};

describe("TwoFactorSection enable flow", () => {
  it("starts TOTP setup immediately for passwordless users", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.enable.mockResolvedValueOnce({
      data: {
        method: "totp",
        totpURI:
          "otpauth://totp/ViteSakuga:alice%40test.com?secret=JBSWY3DPEHPK3PXP&issuer=ViteSakuga",
        backupCodes: ["aaaa-aaaa", "bbbb-bbbb"],
      },
      error: null,
    });

    renderSection({ authClient, hasPassword: false });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));

    await waitFor(() =>
      expect(authClient.twoFactor.enable).toHaveBeenCalledWith({
        password: "",
        method: "totp",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Scan the QR code")).toBeTruthy(),
    );
    expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeTruthy();
  });

  it("shows the error and a retry when TOTP setup fails for passwordless users", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.enable.mockResolvedValueOnce({
      data: null,
      error: { message: "TOTP setup failed" },
    });

    renderSection({ authClient, hasPassword: false });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));

    await waitFor(() =>
      expect(screen.getByText("TOTP setup failed")).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("asks for the password first when the user has one", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.enable.mockResolvedValueOnce({
      data: {
        method: "totp",
        totpURI:
          "otpauth://totp/ViteSakuga:alice%40test.com?secret=JBSWY3DPEHPK3PXP",
        backupCodes: ["aaaa-aaaa"],
      },
      error: null,
    });

    renderSection({ authClient, hasPassword: true });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));

    const dialog = await waitFor(() => screen.getByRole("dialog"));
    await waitFor(() =>
      expect(
        within(dialog).getByText(/Enter your password to confirm/),
      ).toBeTruthy(),
    );

    fireEvent.change(
      within(dialog).getByPlaceholderText("Enter your password"),
      { target: { value: "secret" } },
    );
    fireEvent.submit(document.getElementById("enable-2fa") as HTMLFormElement);

    await waitFor(() =>
      expect(authClient.twoFactor.enable).toHaveBeenCalledWith({
        password: "secret",
        method: "totp",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Scan the QR code")).toBeTruthy(),
    );
  });
});

describe("TwoFactorSection disable flow", () => {
  it("disables without a password for passwordless users", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.disable.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });

    renderSection({ authClient, enabled: true, hasPassword: false });
    fireEvent.click(screen.getByRole("button", { name: "Disable 2FA" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Your account will only be protected by your GitHub or Google sign-in. Confirm to turn off two-factor authentication.",
        ),
      ).toBeTruthy(),
    );

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Disable 2FA",
      }),
    );
    await waitFor(() =>
      expect(authClient.twoFactor.disable).toHaveBeenCalledWith({
        password: "",
      }),
    );
  });

  it("requires the password when the user has one", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.disable.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });

    renderSection({ authClient, enabled: true, hasPassword: true });
    fireEvent.click(screen.getByRole("button", { name: "Disable 2FA" }));

    const dialog = await waitFor(() => screen.getByRole("dialog"));
    fireEvent.change(
      within(dialog).getByPlaceholderText("Enter your password"),
      { target: { value: "secret" } },
    );
    fireEvent.submit(document.getElementById("disable-2fa") as HTMLFormElement);

    await waitFor(() =>
      expect(authClient.twoFactor.disable).toHaveBeenCalledWith({
        password: "secret",
      }),
    );
  });
});

describe("TwoFactorSection backup codes flow", () => {
  it("regenerates backup codes without a password for passwordless users", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.generateBackupCodes.mockResolvedValueOnce({
      data: { backupCodes: ["new-aaaa", "new-bbbb"] },
      error: null,
    });

    renderSection({ authClient, enabled: true, hasPassword: false });
    fireEvent.click(screen.getByRole("button", { name: "Backup codes" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Generate a fresh set of backup codes. Your current codes will stop working immediately.",
        ),
      ).toBeTruthy(),
    );

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Generate new codes",
      }),
    );

    await waitFor(() =>
      expect(authClient.twoFactor.generateBackupCodes).toHaveBeenCalledWith({
        password: "",
      }),
    );
    await waitFor(() => expect(screen.getByText("new-aaaa")).toBeTruthy());
  });
});
