import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  ModerationFnsContext,
  type ModerationFns,
} from "src/lib/moderation/moderation.fn-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { RolesPanel } from "./RolesPanel";

const emptyOverview = { pendingEdits: [], reports: [] };
const createdAt = "2026-11-02T10:00:00.000Z";

describe(RolesPanel, () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("assigns a role with its reason and refreshes the visible history", async () => {
    let events: ReadonlyArray<{
      actorName: string | null;
      actorUserId: string;
      createdAt: string;
      id: number;
      kind: "role-changed";
      newRole: "uploader";
      previousRole: "novice";
      reason: string;
      targetName: string | null;
      targetUserId: string;
    }> = [];
    const fetchModerationOverview = vi.fn(async () => emptyOverview);
    const fetchAccountModerationEvents = vi.fn(async () => events);
    const assignUserRole = vi.fn(
      async ({
        data,
      }: {
        data: { reason?: string; role: string; userId: string };
      }) => {
        events = [
          {
            actorName: null,
            actorUserId: "admin-1",
            createdAt,
            id: 1,
            kind: "role-changed",
            newRole: "uploader",
            previousRole: "novice",
            reason: data.reason ?? "",
            targetName: null,
            targetUserId: data.userId,
          },
        ];
        return { userId: data.userId };
      },
    );
    const fns = {
      assignUserRole,
      fetchAccountModerationEvents,
      fetchModerationOverview,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ModerationFnsContext.Provider
          // SAFETY: RolesPanel only calls the three functions supplied here.
          value={fns as unknown as ModerationFns}
        >
          {children}
        </ModerationFnsContext.Provider>
      </QueryClientProvider>
    );
    render(<RolesPanel />, { wrapper });

    await vi.waitFor(() =>
      expect(fetchAccountModerationEvents).toHaveBeenCalledTimes(1),
    );
    await page.getByLabelText("User ID").fill("target-1");
    await page.getByLabelText("Reason (optional)").fill("staff onboarding");
    await page.getByRole("button", { name: "Assign" }).click();

    await vi.waitFor(() =>
      expect(fetchAccountModerationEvents).toHaveBeenCalledTimes(2),
    );
    expect(assignUserRole).toHaveBeenCalledWith({
      data: {
        reason: "staff onboarding",
        role: "uploader",
        userId: "target-1",
      },
    });
    await expect.element(page.getByText(/staff onboarding/)).toBeVisible();
    await expect
      .element(
        page.getByText(
          "admin-1 changed target-1's role from novice to uploader",
          { exact: true },
        ),
      )
      .toBeVisible();
  });
});
