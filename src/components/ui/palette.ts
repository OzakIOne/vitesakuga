export type Palette = "blue" | "gray" | "red" | "green" | "orange";

export const PALETTE_SOLID = {
  blue: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600/40",
  gray: "bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring-gray-900/40",
  red: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/40",
  green:
    "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/40",
  orange:
    "bg-orange-600 text-white hover:bg-orange-700 focus-visible:ring-orange-600/40",
} satisfies Record<Palette, string>;

export const PALETTE_OUTLINE = {
  blue: "border border-blue-600 text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-600/40 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-blue-950",
  gray: "border border-gray-300 text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400/40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800",
  red: "border border-red-600 text-red-700 hover:bg-red-50 focus-visible:ring-red-600/40 dark:border-red-500 dark:text-red-300 dark:hover:bg-red-950",
  green:
    "border border-green-600 text-green-700 hover:bg-green-50 focus-visible:ring-green-600/40 dark:border-green-500 dark:text-green-300 dark:hover:bg-green-950",
  orange:
    "border border-orange-600 text-orange-700 hover:bg-orange-50 focus-visible:ring-orange-600/40 dark:border-orange-500 dark:text-orange-300 dark:hover:bg-orange-950",
} satisfies Record<Palette, string>;

export const PALETTE_GHOST = {
  blue: "text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-600/40 dark:text-blue-300 dark:hover:bg-blue-950",
  gray: "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400/40 dark:text-gray-300 dark:hover:bg-gray-800",
  red: "text-red-700 hover:bg-red-50 focus-visible:ring-red-600/40 dark:text-red-300 dark:hover:bg-red-950",
  green:
    "text-green-700 hover:bg-green-50 focus-visible:ring-green-600/40 dark:text-green-300 dark:hover:bg-green-950",
  orange:
    "text-orange-700 hover:bg-orange-50 focus-visible:ring-orange-600/40 dark:text-orange-300 dark:hover:bg-orange-950",
} satisfies Record<Palette, string>;

export const PALETTE_SUBTLE = {
  blue: "bg-blue-100 text-blue-800 hover:bg-blue-200 focus-visible:ring-blue-600/40 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900",
  gray: "bg-gray-100 text-gray-800 hover:bg-gray-200 focus-visible:ring-gray-400/40 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
  red: "bg-red-100 text-red-800 hover:bg-red-200 focus-visible:ring-red-600/40 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
  green:
    "bg-green-100 text-green-800 hover:bg-green-200 focus-visible:ring-green-600/40 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900",
  orange:
    "bg-orange-100 text-orange-800 hover:bg-orange-200 focus-visible:ring-orange-600/40 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900",
} satisfies Record<Palette, string>;
