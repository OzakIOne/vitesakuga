import { Progress as ArkProgress } from "@ark-ui/react";
import * as React from "react";
import { LuCircleAlert, LuCircleCheck, LuTriangleAlert } from "react-icons/lu";

import {
  PALETTE_OUTLINE,
  PALETTE_SOLID,
  PALETTE_SUBTLE,
  type Palette,
} from "./palette";
import {
  classToken,
  cn,
  useChakraProps,
  type ChakraStyleProps,
} from "./ui-utils";

type BadgeSize = "xs" | "sm" | "lg";

const BADGE_SIZES = {
  xs: "px-1.5 py-0.5 text-[0.65rem]",
  sm: "px-2 py-0.5 text-xs",
  lg: "px-2.5 py-1 text-sm",
} satisfies Record<BadgeSize, string>;

type BadgeProps = {
  variant?: "subtle" | "solid" | "outline";
  colorScheme?: Palette;
  colorPalette?: Palette;
  size?: string;
} & React.HTMLAttributes<HTMLSpanElement> &
  ChakraStyleProps;

export function Badge({
  variant = "subtle",
  colorScheme,
  colorPalette,
  size = "sm",
  ...props
}: BadgeProps) {
  const { className, style, rest } = useChakraProps(props);
  const palette = colorPalette ?? colorScheme ?? "gray";
  const paletteClasses = {
    subtle: PALETTE_SUBTLE[palette],
    solid: PALETTE_SOLID[palette],
    outline: PALETTE_OUTLINE[palette],
  }[variant];
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        classToken(BADGE_SIZES, size, "sm"),
        paletteClasses,
        className,
      )}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
    />
  );
}

type SpinnerProps = {
  size?: string;
  color?: string;
} & React.HTMLAttributes<HTMLSpanElement> &
  ChakraStyleProps;

export function Spinner({ size = "md", color, ...props }: SpinnerProps) {
  const { className, style, rest } = useChakraProps({
    ...props,
    color: color ?? "gray.600",
  });
  const box =
    size === "xs"
      ? "h-3 w-3 border"
      : size === "sm"
        ? "h-4 w-4 border-2"
        : size === "lg"
          ? "h-8 w-8 border-4"
          : "h-6 w-6 border-2";
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <output
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        box,
        className,
      )}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
    />
  );
}

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps;

export function Skeleton(props: SkeletonProps) {
  const { className, style, rest } = useChakraProps(props);
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded bg-tone-200 dark:bg-tone-700",
        className,
      )}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    />
  );
}

export const Progress = {
  Root: ({
    striped,
    ...props
  }: { striped?: boolean } & React.ComponentProps<typeof ArkProgress.Root> &
    ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style;
    // remaining props match Ark's progress root contract.
    return (
      <ArkProgress.Root
        className={className}
        data-striped={striped || undefined}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkProgress.Root>)}
      />
    );
  },
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
  Label: (
    props: React.ComponentProps<typeof ArkProgress.Label> & ChakraStyleProps,
  ) => (
    <ArkProgress.Label
      className="mb-1 text-sm font-medium"
      {...(props as React.ComponentProps<typeof ArkProgress.Label>)}
    />
  ),
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
  ValueText: (
    props: React.ComponentProps<typeof ArkProgress.ValueText> &
      ChakraStyleProps,
  ) => (
    <ArkProgress.ValueText
      className="text-sm"
      {...(props as React.ComponentProps<typeof ArkProgress.ValueText>)}
    />
  ),
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
  Track: (
    props: React.ComponentProps<typeof ArkProgress.Track> & ChakraStyleProps,
  ) => (
    <ArkProgress.Track
      className="bg-tone-200 dark:bg-tone-700 h-2 w-full overflow-hidden rounded-full"
      {...(props as React.ComponentProps<typeof ArkProgress.Track>)}
    />
  ),
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
  Range: (
    props: React.ComponentProps<typeof ArkProgress.Range> & ChakraStyleProps,
  ) => (
    <ArkProgress.Range
      className="bg-accent-600 h-full rounded-full transition-[width]"
      {...(props as React.ComponentProps<typeof ArkProgress.Range>)}
    />
  ),
};

type AlertProps = {
  ref?: React.Ref<HTMLDivElement>;
  status?: "error" | "success" | "info" | "warning";
} & React.HTMLAttributes<HTMLDivElement> &
  ChakraStyleProps;

export const Alert = {
  Root: ({ status = "error", ...props }: AlertProps) => {
    const { className, style, rest } = useChakraProps(props);
    const statusClasses = {
      error:
        "border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200",
      success:
        "border-success-200 bg-success-50 text-success-800 dark:border-success-900 dark:bg-success-950/40 dark:text-success-200",
      info: "border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-200",
      warning:
        "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200",
    }[status];
    // Errors/warnings are urgent and should interrupt (role="alert");
    // success/info updates are announced politely (role="status").
    const role =
      status === "error" || status === "warning" ? "alert" : "status";
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <div
        className={cn("rounded-md border p-4", statusClasses, className)}
        role={role}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  Content: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <div
        className={cn("flex items-start gap-3", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  Indicator: ({ status = "error" }: { status?: AlertProps["status"] }) => {
    const Icon =
      status === "success"
        ? LuCircleCheck
        : status === "warning"
          ? LuTriangleAlert
          : LuCircleAlert;
    const iconClasses = {
      error: "text-danger-600 dark:text-danger-400",
      success: "text-success-600 dark:text-success-400",
      info: "text-accent-600 dark:text-accent-400",
      warning: "text-warning-600 dark:text-warning-400",
    }[status ?? "error"];
    return (
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 h-5 w-5 shrink-0", iconClasses)}
      />
    );
  },
  Title: (
    props: React.HTMLAttributes<HTMLHeadingElement> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <p
        className={cn("font-semibold", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLHeadingElement>)}
      />
    );
  },
  Description: (
    props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <div
        className={cn("mt-1 text-sm", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
};

export const DataList = {
  Root: ({
    orientation: _orientation,
    ...props
  }: { orientation?: string } & React.HTMLAttributes<HTMLDListElement> &
    ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <dl
        className={cn("flex flex-col gap-2 text-sm", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDListElement>)}
      />
    );
  },
  Item: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <div
        className={cn("grid grid-cols-2 gap-2", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  ItemLabel: (
    props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <dt
        className={cn("text-tone-600 dark:text-tone-400", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  ItemValue: (
    props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <dd
        className={cn("min-w-0 break-words font-medium", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
};
