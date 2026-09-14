import { Tabs as ArkTabs } from "@ark-ui/react";
import * as React from "react";

import { cn, useChakraProps, type ChakraStyleProps } from "./ui-utils";

export const TABS_LIST_BASE =
  "inline-flex items-center gap-1 rounded-lg border border-tone-200 bg-tone-100/60 p-1 dark:border-tone-700 dark:bg-tone-800/60";

export const TABS_TRIGGER_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-tone-600 outline-none transition-colors hover:bg-tone-200/70 hover:text-tone-900 focus-visible:ring-2 focus-visible:ring-accent-500 data-[selected=true]:bg-white data-[selected=true]:text-tone-900 data-[selected=true]:shadow-sm dark:text-tone-400 dark:hover:bg-tone-700/70 dark:hover:text-tone-100 dark:data-[selected=true]:bg-tone-900 dark:data-[selected=true]:text-tone-100";

/** Selected-state styles, for non-Ark tab-like links (e.g. routed tabs). */
export const TABS_TRIGGER_SELECTED =
  "bg-white text-tone-900 shadow-sm dark:bg-tone-900 dark:text-tone-100";

export const Tabs = {
  Root: (
    props: React.ComponentProps<typeof ArkTabs.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkTabs.Root
        className={cn(className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkTabs.Root>)}
      />
    );
  },
  List: (
    props: React.ComponentProps<typeof ArkTabs.List> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkTabs.List
        className={cn(TABS_LIST_BASE, className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkTabs.List>)}
      />
    );
  },
  Trigger: (
    props: React.ComponentProps<typeof ArkTabs.Trigger> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkTabs.Trigger
        className={cn(TABS_TRIGGER_BASE, className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkTabs.Trigger>)}
      />
    );
  },
  Content: (
    props: React.ComponentProps<typeof ArkTabs.Content> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkTabs.Content
        className={cn(className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkTabs.Content>)}
      />
    );
  },
  Indicator: (
    props: React.ComponentProps<typeof ArkTabs.Indicator> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component at the call site.
    return (
      <ArkTabs.Indicator
        className={cn(className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkTabs.Indicator>)}
      />
    );
  },
};
