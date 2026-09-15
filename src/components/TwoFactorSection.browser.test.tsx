import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthClientContext } from "src/lib/auth/client-context";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { TwoFactorSection } from "./TwoFactorSection";

const createMockAuthClient = () => ({
  twoFactor: {
    disable: vi.fn(),
    enable: vi.fn(),
    generateBackupCodes: vi.fn(),
  },
});

vi.mock("src/lib/auth/client", () => ({
  default: {
    twoFactor: {
      disable: vi.fn(),
      enable: vi.fn(),
      generateBackupCodes: vi.fn(),
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  isRedirect: () => false,
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock("src/components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

vi.mock("src/lib/users/users.queries", () => ({
  usersKeys: { accountSecurity: ["accountSecurity"] },
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

const renderSection = async ({
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
  await render(
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

    await renderSection({ authClient, hasPassword: false });
    await page.getByRole("button", { name: "Enable 2FA" }).click();

    await vi.waitFor(() =>
      expect(authClient.twoFactor.enable).toHaveBeenCalledWith({
        password: "",
        method: "totp",
      }),
    );
    await expect.element(page.getByText("Scan the QR code")).toBeVisible();
    await expect.element(page.getByText(/JBSWY3DPEHPK3PXP/)).toBeVisible();
  });

  it("shows the error and a retry when TOTP setup fails for passwordless users", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.enable.mockResolvedValueOnce({
      data: null,
      error: { message: "TOTP setup failed" },
    });

    await renderSection({ authClient, hasPassword: false });
    await page.getByRole("button", { name: "Enable 2FA" }).click();

    await expect.element(page.getByText("TOTP setup failed")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Try again" }))
      .toBeVisible();
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

    await renderSection({ authClient, hasPassword: true });
    await page.getByRole("button", { name: "Enable 2FA" }).click();

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog.getByText(/Enter your password to confirm/))
      .toBeVisible();

    await dialog.getByPlaceholder("Enter your password").fill("secret");
    await page.getByRole("button", { name: "Continue" }).click();

    await vi.waitFor(() =>
      expect(authClient.twoFactor.enable).toHaveBeenCalledWith({
        password: "secret",
        method: "totp",
      }),
    );
    await expect.element(page.getByText("Scan the QR code")).toBeVisible();
  });
});

describe("TwoFactorSection disable flow", () => {
  it("disables without a password for passwordless users", async () => {
    const authClient = createMockAuthClient();
    authClient.twoFactor.disable.mockResolvedValueOnce({
      data: { status: true },
      error: null,
    });

    await renderSection({ authClient, enabled: true, hasPassword: false });
    await page.getByRole("button", { name: "Disable 2FA" }).click();

    await expect
      .element(
        page.getByText(
          "Your account will only be protected by your GitHub or Google sign-in. Confirm to turn off two-factor authentication.",
        ),
      )
      .toBeVisible();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Disable 2FA" })
      .click();
    await vi.waitFor(() =>
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

    await renderSection({ authClient, enabled: true, hasPassword: true });
    await page.getByRole("button", { name: "Disable 2FA" }).click();

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    await dialog.getByPlaceholder("Enter your password").fill("secret");
    await dialog.getByRole("button", { name: "Disable 2FA" }).click();

    await vi.waitFor(() =>
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

    await renderSection({ authClient, enabled: true, hasPassword: false });
    await page.getByRole("button", { name: "Backup codes" }).click();

    await expect
      .element(
        page.getByText(
          "Generate a fresh set of backup codes. Your current codes will stop working immediately.",
        ),
      )
      .toBeVisible();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Generate new codes" })
      .click();

    await vi.waitFor(() =>
      expect(authClient.twoFactor.generateBackupCodes).toHaveBeenCalledWith({
        password: "",
      }),
    );
    await expect.element(page.getByText("new-aaaa")).toBeVisible();
  });
});
