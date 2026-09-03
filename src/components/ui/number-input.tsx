import { NumberInput as ArkNumberInput } from "@ark-ui/react";
import * as React from "react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";

import { cn, useChakraProps, type ChakraStyleProps } from "./ui-utils";

const TRIGGER_BASE =
  "flex w-9 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700";

export const NumberInput = {
  Root: (
    props: React.ComponentProps<typeof ArkNumberInput.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkNumberInput.Root
        className={cn("w-full", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkNumberInput.Root>)}
      />
    );
  },
  Label: (
    props: React.ComponentProps<typeof ArkNumberInput.Label> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkNumberInput.Label
        className={cn(
          "mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkNumberInput.Label>)}
      />
    );
  },
  Control: (
    props: React.ComponentProps<typeof ArkNumberInput.Control> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkNumberInput.Control
        className={cn("flex items-stretch gap-1", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkNumberInput.Control>)}
      />
    );
  },
  Input: (
    props: React.ComponentProps<typeof ArkNumberInput.Input> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkNumberInput.Input
        className={cn(
          "min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkNumberInput.Input>)}
      />
    );
  },
  IncrementTrigger: (
    props: React.ComponentProps<typeof ArkNumberInput.IncrementTrigger> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkNumberInput.IncrementTrigger
        className={cn(TRIGGER_BASE, className)}
        style={style}
        {...(rest as React.ComponentProps<
          typeof ArkNumberInput.IncrementTrigger
        >)}
      >
        {props.children ?? <LuChevronUp />}
      </ArkNumberInput.IncrementTrigger>
    );
  },
  DecrementTrigger: (
    props: React.ComponentProps<typeof ArkNumberInput.DecrementTrigger> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkNumberInput.DecrementTrigger
        className={cn(TRIGGER_BASE, className)}
        style={style}
        {...(rest as React.ComponentProps<
          typeof ArkNumberInput.DecrementTrigger
        >)}
      >
        {props.children ?? <LuChevronDown />}
      </ArkNumberInput.DecrementTrigger>
    );
  },
};
