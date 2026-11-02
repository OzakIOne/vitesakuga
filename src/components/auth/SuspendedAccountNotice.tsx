import { useCapabilities } from "src/lib/auth/capabilities.context";

export const SuspendedAccountNotice = () => {
  const { suspended, suspensionReason } = useCapabilities();
  if (!suspended) return null;

  return (
    <output
      aria-label="Account suspension"
      className="border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200 block rounded-md border px-4 py-3 text-sm"
    >
      <p>Your account is suspended. Content changes are disabled.</p>
      {suspensionReason && <p className="mt-1">Reason: {suspensionReason}</p>}
    </output>
  );
};
