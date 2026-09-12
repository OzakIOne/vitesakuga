// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MentionTextarea } from "./MentionTextarea";

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

const renderComposer = (onChange: (value: string) => void) => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledMentionTextarea onChange={onChange} />
    </QueryClientProvider>,
  );
};

describe(MentionTextarea, () => {
  afterEach(cleanup);

  it("keeps HTML-looking input as literal textarea text while typing", () => {
    const onChange = vi.fn();
    const payload = "<img src=x onerror=alert(1)>";
    renderComposer(onChange);

    const textarea = screen.getByRole("combobox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: payload } });

    expect(textarea.value).toBe(payload);
    expect(onChange).toHaveBeenCalledWith(payload);
    expect(document.querySelector("img")).toBeNull();
  });
});
