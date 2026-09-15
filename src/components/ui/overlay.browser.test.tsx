import { createListCollection } from "@ark-ui/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Combobox } from "./overlay";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Combobox wrapper", () => {
  test("B8: does not pass conflicting value props to its input", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const collection = createListCollection({ items: ["MP4"] });

    await render(
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
