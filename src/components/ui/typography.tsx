import * as React from "react";

import {
  classToken,
  cx,
  useChakraProps,
  type ChakraStyleProps,
} from "./ui-utils";

type TextProps = {
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement> &
  ChakraStyleProps;

type HeadingSize = "4xl" | "3xl" | "2xl" | "xl" | "lg" | "md" | "sm" | "xs";

const HEADING_SIZES = {
  "4xl": "text-4xl",
  "3xl": "text-3xl",
  "2xl": "text-2xl",
  xl: "text-2xl",
  lg: "text-xl",
  md: "text-lg",
  sm: "text-base",
  xs: "text-sm",
} satisfies Record<HeadingSize, string>;

export function Text({ as = "p", ...props }: TextProps) {
  const { className, style, rest } = useChakraProps(props);
  // SAFETY: `as` is an ElementType prop; pretending it is the generic ElementType keeps the cast sound for any caller-supplied tag.
  const Component = as as React.ElementType;
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
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
    fontSize: classToken(HEADING_SIZES, size, "xl"),
    fontWeight: "bold",
  });
  // SAFETY: `as` is an ElementType prop; pretending it is the generic ElementType keeps the cast sound for any caller-supplied tag.
  const Component = as as React.ElementType;
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
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
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <a
      className={cx("hover:underline", className)}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLAnchorElement>)}
    />
  );
}
