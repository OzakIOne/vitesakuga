// @vitest-environment happy-dom
import { createListCollection } from "@ark-ui/react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Combobox } from "./overlay";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Combobox wrapper", () => {
  it("does not pass conflicting value props to its input", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const collection = createListCollection({ items: ["MP4"] });

    render(
      <Combobox.Root
        collection={collection}
        inputValue=""
        onInputValueChange={() => undefined}
      >
        <Combobox.Input />
      </Combobox.Root>,
    );

    expect(
      consoleError.mock.calls.filter(([message]) =>
        String(message).includes("both value and defaultValue"),
      ),
    ).toHaveLength(0);
  });
});
