import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { SearchBox } from "./SearchBox";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  isRedirect: () => false,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  // The search box is rendered in the post-detail sidebar for this test;
  // searches must still leave the detail route for the global results page.
  useLocation: () => ({ pathname: "/posts/148" }),
  useNavigate: () => navigateMock,
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouteContext: () => ({ user: null }),
}));

// The tag collection normally mirrors a local DB collection; a static list
// keeps this component test focused on draft/applied synchronization.
vi.mock("src/lib/tags/tags.hooks", async () => {
  const { createListCollection } = await import("@ark-ui/react");
  return {
    useTagCollection: () => ({
      collection: createListCollection({ items: ["action", "naruto"] }),
    }),
  };
});

vi.mock("./SavedSearchDialogs", () => ({
  SaveSearchDialog: () => null,
  SavedSearchesDialog: () => null,
}));

const renderSearchBox = async (props: Parameters<typeof SearchBox>[0] = {}) => {
  const queryClient = new QueryClient();
  return render(<SearchBox {...props} />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
};

const getInput = () => page.getByLabelText("Search posts");

const pressEnter = (): void => {
  getInput()
    .element()
    .dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    );
};

// The applied tag chips render a remove button with a unique accessible name;
// combobox option items are also in the DOM, so text queries are ambiguous.
const getRemoveTagButton = (tag: string) =>
  page.getByRole("button", { name: `Remove tag ${tag}` });

// Simulate progressive typing so every latest input value reaches the
// debouncer like it would from a real user.
const typeQuery = async (query: string): Promise<void> => {
  for (let index = 1; index <= query.length; index++) {
    await getInput().fill(query.slice(0, index));
  }
};

describe(SearchBox, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("shows the applied query and tags from the URL", async () => {
    await renderSearchBox({ appliedQuery: "Debug", appliedTags: ["action"] });

    await expect.element(getInput()).toHaveValue("Debug");
    await expect.element(getRemoveTagButton("action")).toBeVisible();
  });

  it("B1: snaps the field back to the applied query on Back/Forward navigation", async () => {
    const { rerender } = await renderSearchBox({ appliedQuery: "Debug" });
    await expect.element(getInput()).toHaveValue("Debug");

    // The user searches for something with no matches; the debounced
    // navigation updates both the URL and the results.
    await typeQuery("zzzauditnomatch");
    vi.advanceTimersByTime(500);
    await rerender(<SearchBox appliedQuery="zzzauditnomatch" />);
    await expect.element(getInput()).toHaveValue("zzzauditnomatch");

    // Going back restores the applied query; the field must follow the URL.
    await rerender(<SearchBox appliedQuery="Debug" />);
    await expect.element(getInput()).toHaveValue("Debug");

    // Going forward must bring the no-match query back.
    await rerender(<SearchBox appliedQuery="zzzauditnomatch" />);
    await expect.element(getInput()).toHaveValue("zzzauditnomatch");
  });

  it("snaps the tag chips back to the applied tags on Back/Forward navigation", async () => {
    const { rerender } = await renderSearchBox({ appliedTags: ["action"] });
    await expect.element(getRemoveTagButton("action")).toBeVisible();

    await rerender(<SearchBox appliedTags={["action", "naruto"]} />);
    await expect.element(getRemoveTagButton("naruto")).toBeVisible();

    await rerender(<SearchBox appliedTags={[]} />);
    await expect
      .element(page.getByRole("button", { name: "Remove tag naruto" }))
      .not.toBeInTheDocument();
  });

  it("keeps in-progress typing when its own debounced navigation lands", async () => {
    const { rerender } = await renderSearchBox({ appliedQuery: "" });

    await typeQuery("abcd");
    vi.advanceTimersByTime(500);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0]?.[0]?.search?.q).toBe("abcd");

    // The user keeps typing while the router commits the navigation.
    await getInput().fill("abcde");
    await rerender(<SearchBox appliedQuery="abcd" />);

    await expect.element(getInput()).toHaveValue("abcde");
  });

  it("B2: navigates from post detail to global results on Search click", async () => {
    await renderSearchBox({
      appliedQuery: "Debug",
      appliedTags: ["action"],
      dateRange: "week",
      sortBy: "oldest",
    });

    await getInput().fill("one piece");
    await page.getByRole("button", { name: "Search" }).click();

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: {
        dateRange: "week",
        q: "one piece",
        sortBy: "oldest",
        tags: ["action"],
      },
      to: "/posts",
    });
  });

  it("applies short queries immediately on Enter without waiting for the debouncer", async () => {
    await renderSearchBox({ appliedQuery: "" });

    await getInput().fill("ab");
    pressEnter();

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { dateRange: "all", q: "ab", sortBy: "newest", tags: [] },
      to: "/posts",
    });
  });

  it("B3: auto-applies a pasted query from an empty field", async () => {
    await renderSearchBox({ appliedQuery: "" });

    await getInput().fill("Debug");
    vi.advanceTimersByTime(500);

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
        search: expect.objectContaining({ q: "Debug" }),
      }),
    );
  });

  it("B3: auto-applies clearing the active query", async () => {
    await renderSearchBox({ appliedQuery: "Debug" });

    await getInput().fill("");
    vi.advanceTimersByTime(500);

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replace: true,
        search: expect.objectContaining({ q: "" }),
      }),
    );
  });

  it("cancels an automatic search when the draft falls below the threshold", async () => {
    await renderSearchBox({ appliedQuery: "" });

    await typeQuery("Debug");
    await getInput().fill("D");
    vi.advanceTimersByTime(500);

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("B3: does not navigate twice when Search flushes a pending query", async () => {
    await renderSearchBox({ appliedQuery: "" });

    await typeQuery("Debug");
    await page.getByRole("button", { name: "Search" }).click();

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("B3: does not navigate twice when Enter applies a pending query", async () => {
    await renderSearchBox({ appliedQuery: "" });

    await typeQuery("Debug");
    pressEnter();

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("applies a removed tag immediately with replacement navigation", async () => {
    await renderSearchBox({
      appliedQuery: "Debug",
      appliedTags: ["action", "naruto"],
    });

    await getRemoveTagButton("action").click();

    expect(navigateMock).toHaveBeenCalledWith({
      replace: true,
      search: {
        dateRange: "all",
        q: "Debug",
        sortBy: "newest",
        tags: ["naruto"],
      },
      to: "/posts",
    });
  });
});
