import type { AnyFieldApi } from "@tanstack/react-form";

export function FieldInfo({ field }: { field: AnyFieldApi }) {
  const errors: string[] = [];
  for (const error of field.state.meta.errors) {
    const message =
      typeof error === "string"
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
