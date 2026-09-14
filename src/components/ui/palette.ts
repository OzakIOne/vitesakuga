export type Palette = "blue" | "gray" | "red" | "green" | "orange";

export const PALETTE_SOLID = {
  blue: "bg-accent-600 text-white hover:bg-accent-700 focus-visible:ring-accent-600/40",
  gray: "bg-tone-900 text-white hover:bg-tone-800 focus-visible:ring-tone-900/40",
  red: "bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-600/40",
  green:
    "bg-success-600 text-white hover:bg-success-700 focus-visible:ring-success-600/40",
  orange:
    "bg-warning-600 text-white hover:bg-warning-700 focus-visible:ring-warning-600/40",
} satisfies Record<Palette, string>;

export const PALETTE_OUTLINE = {
  blue: "border border-accent-600 text-accent-700 hover:bg-accent-50 focus-visible:ring-accent-600/40 dark:border-accent-500 dark:text-accent-300 dark:hover:bg-accent-950",
  gray: "border border-tone-300 text-tone-700 hover:bg-tone-100 focus-visible:ring-tone-400/40 dark:border-tone-600 dark:text-tone-300 dark:hover:bg-tone-800",
  red: "border border-danger-600 text-danger-700 hover:bg-danger-50 focus-visible:ring-danger-600/40 dark:border-danger-500 dark:text-danger-300 dark:hover:bg-danger-950",
  green:
    "border border-success-600 text-success-700 hover:bg-success-50 focus-visible:ring-success-600/40 dark:border-success-500 dark:text-success-300 dark:hover:bg-success-950",
  orange:
    "border border-warning-600 text-warning-700 hover:bg-warning-50 focus-visible:ring-warning-600/40 dark:border-warning-500 dark:text-warning-300 dark:hover:bg-warning-950",
} satisfies Record<Palette, string>;

export const PALETTE_GHOST = {
  blue: "text-accent-700 hover:bg-accent-50 focus-visible:ring-accent-600/40 dark:text-accent-300 dark:hover:bg-accent-950",
  gray: "text-tone-700 hover:bg-tone-100 focus-visible:ring-tone-400/40 dark:text-tone-300 dark:hover:bg-tone-800",
  red: "text-danger-700 hover:bg-danger-50 focus-visible:ring-danger-600/40 dark:text-danger-300 dark:hover:bg-danger-950",
  green:
    "text-success-700 hover:bg-success-50 focus-visible:ring-success-600/40 dark:text-success-300 dark:hover:bg-success-950",
  orange:
    "text-warning-700 hover:bg-warning-50 focus-visible:ring-warning-600/40 dark:text-warning-300 dark:hover:bg-warning-950",
} satisfies Record<Palette, string>;

export const PALETTE_SUBTLE = {
  blue: "bg-accent-100 text-accent-800 hover:bg-accent-200 focus-visible:ring-accent-600/40 dark:bg-accent-950 dark:text-accent-300 dark:hover:bg-accent-900",
  gray: "bg-tone-100 text-tone-800 hover:bg-tone-200 focus-visible:ring-tone-400/40 dark:bg-tone-800 dark:text-tone-200 dark:hover:bg-tone-700",
  red: "bg-danger-100 text-danger-800 hover:bg-danger-200 focus-visible:ring-danger-600/40 dark:bg-danger-950 dark:text-danger-300 dark:hover:bg-danger-900",
  green:
    "bg-success-100 text-success-800 hover:bg-success-200 focus-visible:ring-success-600/40 dark:bg-success-950 dark:text-success-300 dark:hover:bg-success-900",
  orange:
    "bg-warning-100 text-warning-800 hover:bg-warning-200 focus-visible:ring-warning-600/40 dark:bg-warning-950 dark:text-warning-300 dark:hover:bg-warning-900",
} satisfies Record<Palette, string>;
