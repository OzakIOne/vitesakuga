import * as React from "react";
import { LuX } from "react-icons/lu";

import {
  classToken,
  cx,
  Slot,
  useChakraProps,
  type ChakraStyleProps,
} from "./ui-utils";

type Variant = "solid" | "outline" | "ghost" | "subtle";
type Palette = "blue" | "gray" | "red" | "green" | "orange";

const SOLID_CLASSES = {
  blue: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600/40",
  gray: "bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:ring-neutral-900/40",
  red: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/40",
  green:
    "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/40",
  orange:
    "bg-orange-600 text-white hover:bg-orange-700 focus-visible:ring-orange-600/40",
} satisfies Record<Palette, string>;

const OUTLINE_CLASSES = {
  blue: "border border-blue-600 text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-600/40",
  gray: "border border-gray-300 text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400/40",
  red: "border border-red-600 text-red-700 hover:bg-red-50 focus-visible:ring-red-600/40",
  green:
    "border border-green-600 text-green-700 hover:bg-green-50 focus-visible:ring-green-600/40",
  orange:
    "border border-orange-600 text-orange-700 hover:bg-orange-50 focus-visible:ring-orange-600/40",
} satisfies Record<Palette, string>;

const GHOST_CLASSES = {
  blue: "text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-600/40",
  gray: "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400/40",
  red: "text-red-700 hover:bg-red-50 focus-visible:ring-red-600/40",
  green: "text-green-700 hover:bg-green-50 focus-visible:ring-green-600/40",
  orange: "text-orange-700 hover:bg-orange-50 focus-visible:ring-orange-600/40",
} satisfies Record<Palette, string>;

const SUBTLE_CLASSES = {
  blue: "bg-blue-100 text-blue-800 hover:bg-blue-200 focus-visible:ring-blue-600/40",
  gray: "bg-gray-100 text-gray-800 hover:bg-gray-200 focus-visible:ring-gray-400/40",
  red: "bg-red-100 text-red-800 hover:bg-red-200 focus-visible:ring-red-600/40",
  green:
    "bg-green-100 text-green-800 hover:bg-green-200 focus-visible:ring-green-600/40",
  orange:
    "bg-orange-100 text-orange-800 hover:bg-orange-200 focus-visible:ring-orange-600/40",
} satisfies Record<Palette, string>;

type Size = "xs" | "sm" | "md" | "lg";

const SIZES = {
  xs: "h-6 px-2 text-xs",
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
} satisfies Record<Size, string>;

const ICON_SIZES = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
} satisfies Record<Size, string>;

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

export type ButtonProps = {
  variant?: Variant;
  colorScheme?: Palette;
  colorPalette?: Palette;
  size?: string;
  loading?: boolean;
  loadingText?: string;
  asChild?: boolean;
  type?: "button" | "submit" | "reset";
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  ChakraStyleProps;

export function buttonClasses({
  variant = "solid",
  colorScheme,
  colorPalette,
  size = "md",
}: {
  variant: Variant | undefined;
  colorScheme: Palette | undefined;
  colorPalette: Palette | undefined;
  size: string | undefined;
}): string {
  const palette = colorPalette ?? colorScheme ?? "gray";
  const variantClasses = {
    solid: SOLID_CLASSES[palette],
    outline: OUTLINE_CLASSES[palette],
    ghost: GHOST_CLASSES[palette],
    subtle: SUBTLE_CLASSES[palette],
  }[variant];
  return cx(BASE, classToken(SIZES, size, "md"), variantClasses);
}

function Spinner({ size = "sm" }: { size?: string }) {
  const border =
    size === "xs" ? "border" : size === "lg" ? "border-4" : "border-2";
  const box = size === "xs" ? "h-3 w-3" : size === "lg" ? "h-8 w-8" : "h-4 w-4";
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent",
        border,
        box,
      )}
    />
  );
}

export function Button({
  variant,
  colorScheme,
  colorPalette,
  size = "md",
  loading = false,
  loadingText,
  asChild = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const { className, style, rest } = useChakraProps(props);
  const classes = cx(
    buttonClasses({ colorPalette, colorScheme, size, variant }),
    className,
  );
  const isDisabled = disabled || loading;
  const content = loading ? (
    <>
      <Spinner size={size} />
      {loadingText ?? children}
    </>
  ) : (
    children
  );

  if (asChild) {
    // SAFETY: useChakraProps strips Chakra style props into className/style; children is rendered by a Slot that accepts any React element.
    return (
      <Slot
        aria-disabled={isDisabled ? "true" : undefined}
        className={classes}
        data-loading={loading ? "" : undefined}
        style={style}
        {...rest}
      >
        {children as React.ReactElement}
      </Slot>
    );
  }

  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <button
      className={classes}
      disabled={isDisabled}
      style={style}
      type="button"
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
}

export function IconButton({
  size = "md",
  variant = "solid",
  colorScheme,
  colorPalette,
  loading = false,
  disabled,
  "aria-label": ariaLabel,
  children,
  ...props
}: ButtonProps) {
  const { className, style, rest } = useChakraProps(props);
  // SAFETY: colorScheme/colorPalette are both the Palette union and default to "gray", keeping the key within the palette class maps.
  const palette = (colorScheme ?? colorPalette ?? "gray") as Palette;
  const variantClasses = {
    solid: SOLID_CLASSES[palette],
    outline: OUTLINE_CLASSES[palette],
    ghost: GHOST_CLASSES[palette],
    subtle: SUBTLE_CLASSES[palette],
  }[variant];
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <button
      aria-label={ariaLabel}
      className={cx(
        BASE,
        classToken(ICON_SIZES, size, "md"),
        variantClasses,
        className,
      )}
      disabled={disabled || loading}
      style={style}
      type="button"
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {loading ? <Spinner size={size} /> : children}
    </button>
  );
}

export function CloseButton({
  size = "md",
  "aria-label": ariaLabel = "Close",
  ...props
}: ButtonProps) {
  return (
    <IconButton aria-label={ariaLabel} size={size} variant="ghost" {...props}>
      <LuX />
    </IconButton>
  );
}
