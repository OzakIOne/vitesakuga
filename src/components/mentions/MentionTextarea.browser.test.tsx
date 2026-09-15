import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { MentionTextarea } from "./MentionTextarea";

vi.mock("src/lib/users/users.queries", () => ({
  mentionSearchQueryOptions: (query: string) => ({
    queryFn: async () => [],
    queryKey: ["mention-search", query],
  }),
}));

function ControlledMentionTextarea({
  onChange,
}: {
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <MentionTextarea
      label="Comment"
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
      value={value}
    />
  );
}

const renderComposer = async (onChange: (value: string) => void) => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledMentionTextarea onChange={onChange} />
    </QueryClientProvider>,
  );
};

describe(MentionTextarea, () => {
  test("keeps HTML-looking input as literal textarea text while typing", async () => {
    const onChange = vi.fn();
    const payload = "<img src=x onerror=alert(1)>";
    await renderComposer(onChange);

    const textarea = page.getByRole("combobox");
    await textarea.fill(payload);

    await expect.element(textarea).toHaveValue(payload);
    expect(onChange).toHaveBeenCalledWith(payload);
    await expect.element(page.getByRole("img")).not.toBeInTheDocument();
  });
});
