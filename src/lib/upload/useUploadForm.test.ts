import { describe, expect, it } from "vitest";

import { toFormValidationErrors } from "./useUploadForm";

describe("toFormValidationErrors", () => {
  it("maps top-level property paths to their fields", () => {
    const result = toFormValidationErrors([
      { message: "Must be at least 3 characters", path: ["description"] },
    ]);
    expect(result.fields).toEqual({
      description: "Must be at least 3 characters",
    });
    expect(result.form).toBeUndefined();
  });

  it("keeps the first message when a field fails several checks", () => {
    const result = toFormValidationErrors([
      { message: "first", path: ["description"] },
      { message: "second", path: ["description"] },
    ]);
    expect(result.fields["description"]).toBe("first");
  });

  it("turns nested paths and form-level checks into form errors", () => {
    const result = toFormValidationErrors([
      { message: "At most 5 images per post", path: [] },
      { message: "Invalid file", path: ["images", "0"] },
    ]);
    expect(result.fields).toEqual({});
    expect(result.form).toBe(
      'At most 5 images per post; Invalid file at ["images", "0"]',
    );
  });
});
