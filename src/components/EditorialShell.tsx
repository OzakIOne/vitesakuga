import type { ReactNode } from "react";

type EditorialShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function EditorialShell({
  children,
  description,
  eyebrow,
  title,
}: EditorialShellProps) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <header className="mb-12">
        <p className="text-accent-600 dark:text-accent-400 mb-3 text-sm font-medium">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="text-tone-600 dark:text-tone-400 mt-4 text-lg">
          {description}
        </p>
      </header>
      {children}
    </div>
  );
}
