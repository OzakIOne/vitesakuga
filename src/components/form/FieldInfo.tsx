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

  // Errors are rendered as soon as they exist: field validators only run on
  // blur/submit, so a populated error list always reflects a real validation
  // pass and does not need an extra "was the field touched" guard.
  return (
    <>
      {errors.length > 0 ? (
        <p className="text-sm break-words text-red-700" role="alert">
          {errors.join(", ")}
        </p>
      ) : null}
      {field.state.meta.isValidating ? (
        <p aria-live="polite">Validating...</p>
      ) : null}
    </>
  );
}
