import * as React from "react";
import { LuX } from "react-icons/lu";

import {
  PALETTE_GHOST,
  PALETTE_OUTLINE,
  PALETTE_SOLID,
  PALETTE_SUBTLE,
  type Palette,
} from "./palette";
import {
  classToken,
  cn,
  Slot,
  useChakraProps,
  type ChakraStyleProps,
} from "./ui-utils";

type Variant = "solid" | "outline" | "ghost" | "subtle";

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
  ref?: React.Ref<HTMLButtonElement>;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  ChakraStyleProps;

function buttonClasses({
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
    solid: PALETTE_SOLID[palette],
    outline: PALETTE_OUTLINE[palette],
    ghost: PALETTE_GHOST[palette],
    subtle: PALETTE_SUBTLE[palette],
  }[variant];
  return cn(BASE, classToken(SIZES, size, "md"), variantClasses);
}

function Spinner({ size = "sm" }: { size?: string }) {
  const border =
    size === "xs" ? "border" : size === "lg" ? "border-4" : "border-2";
  const box = size === "xs" ? "h-3 w-3" : size === "lg" ? "h-8 w-8" : "h-4 w-4";
  return (
    <span
      aria-hidden="true"
      className={cn(
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
  onClick,
  children,
  ...props
}: ButtonProps) {
  const { className, style, rest } = useChakraProps(props);
  const classes = cn(
    buttonClasses({ colorPalette, colorScheme, size, variant }),
    className,
  );
  const isDisabled = disabled || loading;
  const content = loading ? (
    <>
      <Spinner size={size} />
      {!loadingText && <span className="sr-only">Loading: </span>}
      {loadingText ?? children}
    </>
  ) : (
    children
  );
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  if (asChild) {
    // SAFETY: useChakraProps strips Chakra style props into className/style; children is rendered by a Slot that accepts any React element.
    return (
      <Slot
        aria-busy={loading || undefined}
        aria-disabled={isDisabled ? "true" : undefined}
        className={classes}
        data-loading={loading ? "" : undefined}
        onClick={handleClick}
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
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={classes}
      disabled={disabled}
      onClick={handleClick}
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
  onClick,
  "aria-label": ariaLabel,
  children,
  ...props
}: ButtonProps) {
  const { className, style, rest } = useChakraProps(props);
  // SAFETY: colorScheme/colorPalette are both the Palette union and default to "gray", keeping the key within the palette class maps.
  const palette = (colorScheme ?? colorPalette ?? "gray") as Palette;
  const variantClasses = {
    solid: PALETTE_SOLID[palette],
    outline: PALETTE_OUTLINE[palette],
    ghost: PALETTE_GHOST[palette],
    subtle: PALETTE_SUBTLE[palette],
  }[variant];
  const isDisabled = disabled || loading;
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <button
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      aria-label={ariaLabel}
      className={cn(
        BASE,
        classToken(ICON_SIZES, size, "md"),
        variantClasses,
        className,
      )}
      disabled={disabled}
      onClick={handleClick}
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
