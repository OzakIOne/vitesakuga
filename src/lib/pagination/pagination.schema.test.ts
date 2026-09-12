import { describe, expect, it } from "vitest";

import { parseStrict } from "../effect/schema.utils";
import {
  MAX_PAGE_NUMBER,
  PageNumberSchema,
  PageNumberWithDefaultSchema,
} from "./pagination.schema";

describe("page number schemas", () => {
  it("defaults omitted page numbers to the first page", () => {
    expect(parseStrict(PageNumberWithDefaultSchema)(undefined)).toBe(0);
  });

  it("accepts the configured upper bound", () => {
    expect(parseStrict(PageNumberSchema)(MAX_PAGE_NUMBER)).toBe(
      MAX_PAGE_NUMBER,
    );
  });

  it("rejects page numbers that would create an excessive offset", () => {
    expect(() => parseStrict(PageNumberSchema)(MAX_PAGE_NUMBER + 1)).toThrow();
  });
});
