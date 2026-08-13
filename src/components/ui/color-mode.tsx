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

export type ColorMode = "light" | "dark";

export type UseColorModeReturn = {
  colorMode: ColorMode;
  setColorMode: (colorMode: ColorMode) => void;
  toggleColorMode: () => void;
};

export function useColorMode(): UseColorModeReturn {
  const { theme, setTheme, resolvedTheme } = useTheme();
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
    setColorMode: setTheme,
    toggleColorMode,
  };
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode();
  return colorMode === "dark" ? dark : light;
}

export function ColorModeIcon() {
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
