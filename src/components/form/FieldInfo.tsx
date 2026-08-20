import type { AnyFieldApi } from "@tanstack/react-form";

export function FieldInfo({ field }: { field: AnyFieldApi }) {
  const errors: string[] = [];
  for (const error of field.state.meta.errors) {
    // SAFETY: validation errors from TanStack Form that aren't strings are
    // either objects carrying a `message` string or null/undefined; the `?.`
    // short-circuits the nullable members of that union.
    const message =
      String(error) === error
        ? error
        : ((error as { message?: string } | null | undefined)?.message ?? "");
    if (message) {
      errors.push(message);
    }
  }

  return (
    <>
      {field.state.meta.isTouched && errors.length > 0 ? (
        <p className="text-sm text-red-700">{errors.join(", ")}</p>
      ) : null}
      {field.state.meta.isValidating ? "Validating..." : null}
    </>
  );
}
