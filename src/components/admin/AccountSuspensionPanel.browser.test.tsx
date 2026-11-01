import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "src/components/ui/toaster";
import { ReauthenticationRequiredError } from "src/lib/errors";
import {
  ModerationFnsContext,
  type ModerationFns,
} from "src/lib/moderation/moderation.fn-context";
import { useModerationOverview } from "src/lib/moderation/moderation.hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { AccountSuspensionPanel } from "./AccountSuspensionPanel";

const emptyOverview = { pendingEdits: [], reports: [] };

const OverviewProbe = () => {
  const overview = useModerationOverview();
  return <p>{overview.isSuccess ? "overview loaded" : "loading"}</p>;
};

describe(AccountSuspensionPanel, () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderPanel = (fns: Record<string, unknown>, withToaster = false) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ModerationFnsContext.Provider
          // SAFETY: the panel and probe only read the fetchers and mutations
          // supplied here; every other server function is never called.
          value={fns as unknown as ModerationFns}
        >
          {children}
        </ModerationFnsContext.Provider>
      </QueryClientProvider>
    );
    return render(
      <>
        {withToaster && <Toaster />}
        <AccountSuspensionPanel />
        <OverviewProbe />
      </>,
      { wrapper },
    );
  };

  it("suspends the account with its reason and refreshes the staff queue", async () => {
    const fetchModerationOverview = vi.fn(async () => emptyOverview);
    const suspendUser = vi.fn(async ({ data }: { data: unknown }) => data);
    renderPanel({ fetchModerationOverview, suspendUser });

    await vi.waitFor(() =>
      expect(fetchModerationOverview).toHaveBeenCalledTimes(1),
    );
    await page.getByLabelText("Account user ID").fill("user-2");
    await page.getByLabelText("Suspension reason").fill("Spam links");
    await page.getByRole("button", { name: "Suspend" }).click();

    await vi.waitFor(() =>
      expect(fetchModerationOverview).toHaveBeenCalledTimes(2),
    );
    expect(suspendUser).toHaveBeenCalledWith({
      data: { reason: "Spam links", userId: "user-2" },
    });
  });

  it("does not suspend an account without a reason", async () => {
    const fetchModerationOverview = vi.fn(async () => emptyOverview);
    const suspendUser = vi.fn(async ({ data }: { data: unknown }) => data);
    renderPanel({ fetchModerationOverview, suspendUser });

    await page.getByLabelText("Account user ID").fill("user-2");
    await page.getByRole("button", { name: "Suspend" }).click();

    await vi.waitFor(() => expect(suspendUser).not.toHaveBeenCalled());
  });

  it("shows reauthentication guidance and an action for stale sessions", async () => {
    const fetchModerationOverview = vi.fn(async () => emptyOverview);
    const suspendUser = vi.fn(async () => {
      throw new ReauthenticationRequiredError({
        message:
          "Your sign-in is too old for this admin action. Please sign in again.",
      });
    });
    renderPanel({ fetchModerationOverview, suspendUser }, true);

    await page.getByLabelText("Account user ID").fill("staff-2");
    await page.getByLabelText("Suspension reason").fill("Spam links");
    await page.getByRole("button", { name: "Suspend" }).click();

    await vi.waitFor(() =>
      expect(
        page.getByText(
          "Your sign-in is too old for this admin action. Please sign in again.",
        ),
      ).toBeVisible(),
    );
    await vi.waitFor(() =>
      expect(page.getByRole("button", { name: "Sign in again" })).toBeVisible(),
    );
  });

  it("restores a suspended account and refreshes the staff queue", async () => {
    const fetchModerationOverview = vi.fn(async () => emptyOverview);
    const unsuspendUser = vi.fn(async ({ data }: { data: unknown }) => data);
    renderPanel({ fetchModerationOverview, unsuspendUser });

    await vi.waitFor(() =>
      expect(fetchModerationOverview).toHaveBeenCalledTimes(1),
    );
    await page.getByLabelText("Account user ID").fill("user-2");
    await page.getByRole("button", { name: "Restore" }).click();

    await vi.waitFor(() =>
      expect(fetchModerationOverview).toHaveBeenCalledTimes(2),
    );
    expect(unsuspendUser).toHaveBeenCalledWith({ data: { userId: "user-2" } });
  });
});
