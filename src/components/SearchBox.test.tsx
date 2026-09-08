// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchBox } from "./SearchBox";

// Ark UI's combobox machine observes element size changes; happy-dom does not
// ship a ResizeObserver, so provide a no-op implementation.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  // The search box is rendered in the post-detail sidebar for this test;
  // searches must still leave the detail route for the global results page.
  useLocation: () => ({ pathname: "/posts/148" }),
  useNavigate: () => navigateMock,
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

const renderSearchBox = (props: Parameters<typeof SearchBox>[0] = {}) => {
  const queryClient = new QueryClient();
  return render(<SearchBox {...props} />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
};

const getInput = (): HTMLInputElement =>
  screen.getByLabelText("Search posts") as HTMLInputElement;

// The applied tag chips render a remove button with a unique accessible name;
// combobox option items are also in the DOM, so text queries are ambiguous.
const getRemoveTagButton = (tag: string): HTMLButtonElement =>
  screen.getByRole("button", {
    name: `Remove tag ${tag}`,
  }) as HTMLButtonElement;

// Simulate progressive typing so every latest input value reaches the
// debouncer like it would from a real user.
const typeQuery = (query: string): void => {
  for (let index = 1; index <= query.length; index++) {
    fireEvent.change(getInput(), { target: { value: query.slice(0, index) } });
  }
};

describe(SearchBox, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("shows the applied query and tags from the URL", () => {
    renderSearchBox({ appliedQuery: "Debug", appliedTags: ["action"] });

    expect(getInput().value).toBe("Debug");
    expect(getRemoveTagButton("action")).toBeDefined();
  });

  it("B1: snaps the field back to the applied query on Back/Forward navigation", () => {
    const { rerender } = renderSearchBox({ appliedQuery: "Debug" });
    expect(getInput().value).toBe("Debug");

    // The user searches for something with no matches; the debounced
    // navigation updates both the URL and the results.
    typeQuery("zzzauditnomatch");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(<SearchBox appliedQuery="zzzauditnomatch" />);
    expect(getInput().value).toBe("zzzauditnomatch");

    // Going back restores the applied query; the field must follow the URL.
    rerender(<SearchBox appliedQuery="Debug" />);
    expect(getInput().value).toBe("Debug");

    // Going forward must bring the no-match query back.
    rerender(<SearchBox appliedQuery="zzzauditnomatch" />);
    expect(getInput().value).toBe("zzzauditnomatch");
  });

  it("snaps the tag chips back to the applied tags on Back/Forward navigation", () => {
    const { rerender } = renderSearchBox({ appliedTags: ["action"] });
    expect(getRemoveTagButton("action")).toBeDefined();

    rerender(<SearchBox appliedTags={["action", "naruto"]} />);
    expect(getRemoveTagButton("naruto")).toBeDefined();

    rerender(<SearchBox appliedTags={[]} />);
    expect(
      screen.queryByRole("button", { name: "Remove tag naruto" }),
    ).toBeNull();
  });

  it("keeps in-progress typing when its own debounced navigation lands", () => {
    const { rerender } = renderSearchBox({ appliedQuery: "" });

    typeQuery("abcd");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0]?.[0]?.search?.q).toBe("abcd");

    // The user keeps typing while the router commits the navigation.
    fireEvent.change(getInput(), { target: { value: "abcde" } });
    rerender(<SearchBox appliedQuery="abcd" />);

    expect(getInput().value).toBe("abcde");
  });

  it("B2: navigates from post detail to global results on Search click", () => {
    renderSearchBox({
      appliedQuery: "Debug",
      appliedTags: ["action"],
      dateRange: "week",
      sortBy: "oldest",
    });

    fireEvent.change(getInput(), { target: { value: "one piece" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(navigateMock).toHaveBeenCalledWith({
      search: {
        dateRange: "week",
        q: "one piece",
        sortBy: "oldest",
        tags: ["action"],
      },
      to: "/posts",
    });
  });

  it("applies short queries immediately on Enter without waiting for the debouncer", () => {
    renderSearchBox({ appliedQuery: "" });

    fireEvent.change(getInput(), { target: { value: "ab" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });

    expect(navigateMock).toHaveBeenCalledWith({
      search: { dateRange: "all", q: "ab", sortBy: "newest", tags: [] },
      to: "/posts",
    });
  });

  it("B3: auto-applies a pasted query from an empty field", () => {
    renderSearchBox({ appliedQuery: "" });

    fireEvent.change(getInput(), { target: { value: "Debug" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ q: "Debug" }),
      }),
    );
  });

  it("B3: auto-applies clearing the active query", () => {
    renderSearchBox({ appliedQuery: "Debug" });

    fireEvent.change(getInput(), { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ q: "" }),
      }),
    );
  });

  it("cancels an automatic search when the draft falls below the threshold", () => {
    renderSearchBox({ appliedQuery: "" });

    typeQuery("Debug");
    fireEvent.change(getInput(), { target: { value: "D" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("B3: does not navigate twice when Search flushes a pending query", () => {
    renderSearchBox({ appliedQuery: "" });

    typeQuery("Debug");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("B3: does not navigate twice when Enter applies a pending query", () => {
    renderSearchBox({ appliedQuery: "" });

    typeQuery("Debug");
    fireEvent.keyDown(getInput(), { key: "Enter" });

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });
});
