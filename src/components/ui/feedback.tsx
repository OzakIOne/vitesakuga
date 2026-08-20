import { Progress as ArkProgress } from "@ark-ui/react";
import * as React from "react";
import { LuCircleAlert, LuCircleCheck, LuTriangleAlert } from "react-icons/lu";

import {
  classToken,
  cx,
  useChakraProps,
  type ChakraStyleProps,
} from "./ui-utils";

type Palette = "blue" | "gray" | "red" | "green" | "orange";

const SUBTLE_BADGE = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  orange:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
} satisfies Record<Palette, string>;

const SOLID_BADGE = {
  blue: "bg-blue-600 text-white",
  gray: "bg-gray-900 text-white",
  red: "bg-red-600 text-white",
  green: "bg-green-600 text-white",
  orange: "bg-orange-600 text-white",
} satisfies Record<Palette, string>;

const OUTLINE_BADGE = {
  blue: "border border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300",
  gray: "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300",
  red: "border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
  green:
    "border border-green-300 text-green-700 dark:border-green-800 dark:text-green-300",
  orange:
    "border border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-300",
} satisfies Record<Palette, string>;

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
    subtle: SUBTLE_BADGE[palette],
    solid: SOLID_BADGE[palette],
    outline: OUTLINE_BADGE[palette],
  }[variant];
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <span
      className={cx(
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
    <span
      aria-label="Loading"
      className={cx(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        box,
        className,
      )}
      role="status"
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
      className={cx("animate-pulse rounded bg-gray-200", className)}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    />
  );
}

export const Progress = {
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
  Root: ({
    striped: _striped,
    ...props
  }: { striped?: boolean } & React.ComponentProps<typeof ArkProgress.Root> &
    ChakraStyleProps) => (
    <ArkProgress.Root
      {...(props as React.ComponentProps<typeof ArkProgress.Root>)}
    />
  ),
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
      className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      {...(props as React.ComponentProps<typeof ArkProgress.Track>)}
    />
  ),
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
  Range: (
    props: React.ComponentProps<typeof ArkProgress.Range> & ChakraStyleProps,
  ) => (
    <ArkProgress.Range
      className="h-full rounded-full bg-blue-600 transition-all"
      {...(props as React.ComponentProps<typeof ArkProgress.Range>)}
    />
  ),
};

type AlertProps = {
  status?: "error" | "success" | "info" | "warning";
} & React.HTMLAttributes<HTMLDivElement> &
  ChakraStyleProps;

export const Alert = {
  Root: ({ status = "error", ...props }: AlertProps) => {
    const { className, style, rest } = useChakraProps(props);
    const statusClasses = {
      error: "border-red-200 bg-red-50 text-red-800",
      success: "border-green-200 bg-green-50 text-green-800",
      info: "border-blue-200 bg-blue-50 text-blue-800",
      warning: "border-orange-200 bg-orange-50 text-orange-800",
    }[status];
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <div
        className={cx("rounded-md border p-4", statusClasses, className)}
        role="alert"
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
        className={cx("flex items-start gap-3", className)}
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
      error: "text-red-600",
      success: "text-green-600",
      info: "text-blue-600",
      warning: "text-orange-600",
    }[status ?? "error"];
    return <Icon className={cx("mt-0.5 h-5 w-5 shrink-0", iconClasses)} />;
  },
  Title: (
    props: React.HTMLAttributes<HTMLHeadingElement> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <p
        className={cx("font-semibold", className)}
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
        className={cx("mt-1 text-sm", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
};

export const DataList = {
  Root: ({
    orientation,
    ...props
  }: { orientation?: string } & React.HTMLAttributes<HTMLDListElement> &
    ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <dl
        className={cx("flex flex-col gap-2 text-sm", className)}
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
        className={cx("grid grid-cols-2 gap-2", className)}
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
        className={cx("text-gray-500", className)}
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
        className={cx("min-w-0 break-words font-medium", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
};
