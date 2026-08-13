import * as React from "react";

import { cx, useChakraProps, type ChakraStyleProps } from "./ui-utils";

type TextProps = {
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement> &
  ChakraStyleProps;

const HEADING_SIZES: Record<string, string> = {
  "4xl": "text-4xl",
  "3xl": "text-3xl",
  "2xl": "text-2xl",
  xl: "text-2xl",
  lg: "text-xl",
  md: "text-lg",
  sm: "text-base",
  xs: "text-sm",
};

export function Text({ as = "p", ...props }: TextProps) {
  const { className, style, rest } = useChakraProps(props);
  const Component = as as React.ElementType;
  return (
    <Component
      className={cx(className)}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    />
  );
}

export function Heading({
  as = "h2",
  size = "xl",
  ...props
}: TextProps & { size?: string }) {
  const { className, style, rest } = useChakraProps({
    ...props,
    fontSize: HEADING_SIZES[size] ?? HEADING_SIZES["xl"],
    fontWeight: "bold",
  });
  const Component = as as React.ElementType;
  return (
    <Component
      className={cx(className)}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    />
  );
}

type LinkProps = {
  href?: string;
  download?: string;
  target?: string;
  rel?: string;
} & React.HTMLAttributes<HTMLAnchorElement> &
  ChakraStyleProps;

export function Link(props: LinkProps) {
  const { className, style, rest } = useChakraProps({
    ...props,
    color: props.color ?? "blue.600",
  });
  return (
    <a
      className={cx("hover:underline", className)}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLAnchorElement>)}
    />
  );
}
