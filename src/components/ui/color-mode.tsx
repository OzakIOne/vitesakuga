"use client";

import { ClientOnly } from "@ark-ui/react";
import { ThemeProvider, useTheme } from "next-themes";
import * as React from "react";
import { LuMonitor, LuMoon, LuSun } from "react-icons/lu";

import { IconButton, type ButtonProps } from "./button";
import { Skeleton } from "./feedback";

export type ColorModeProviderProps = {} & React.ComponentProps<
  typeof ThemeProvider
>;

export function ColorModeProvider(props: ColorModeProviderProps) {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange {...props} />
  );
}

type ColorMode = "light" | "dark";

type ColorModeSelection = ColorMode | "system";

export const COLOR_MODE_OPTIONS: ReadonlyArray<{
  value: ColorModeSelection;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "light", label: "Light", icon: <LuSun /> },
  { value: "dark", label: "Dark", icon: <LuMoon /> },
  { value: "system", label: "System", icon: <LuMonitor /> },
];

export type UseColorModeReturn = {
  /** The resolved color mode ("system" resolves to light or dark). */
  colorMode: ColorMode;
  /** The raw user selection: "light" | "dark" | "system". */
  theme: ColorModeSelection;
  setColorMode: (colorMode: ColorModeSelection) => void;
  toggleColorMode: () => void;
};

export function useColorMode(): UseColorModeReturn {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // SAFETY: next-themes only ever resolves to "light" or "dark" once mounted.
  const colorMode = resolvedTheme as ColorMode;
  const toggleColorMode = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };
  return {
    colorMode,
    // SAFETY: next-themes' theme is always one of "light" | "dark" | "system"
    // (or undefined before mount); nullish-coalescing restores the "system" default.
    theme: (theme ?? "system") as ColorModeSelection,
    setColorMode: setTheme,
    toggleColorMode,
  };
}

function ColorModeIcon() {
  const { theme } = useTheme();
  if (theme === "system") {
    return <LuMonitor />;
  }
  return theme === "dark" ? <LuMoon /> : <LuSun />;
}

type ColorModeButtonProps = {} & Omit<ButtonProps, "aria-label">;

export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode();
  return (
    <ClientOnly fallback={<Skeleton boxSize="8" />}>
      <IconButton
        aria-label="Toggle color mode"
        onClick={toggleColorMode}
        ref={ref}
        size="sm"
        variant="ghost"
        {...props}
      >
        <ColorModeIcon />
      </IconButton>
    </ClientOnly>
  );
});
