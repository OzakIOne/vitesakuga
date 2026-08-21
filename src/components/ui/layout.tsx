import * as React from "react";

import {
  asDivProps,
  asSpanProps,
  cx,
  useChakraProps,
  type ChakraStyleProps,
} from "./ui-utils";

type BoxProps = React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps;

function mapTemplateColumns(value: string): string {
  const str = value;
  if (str === "1fr") return "grid-cols-1";
  if (str.startsWith("repeat(")) {
    const match = str.match(/^repeat\((\d+)/);
    if (match) return `grid-cols-${match[1]}`;
  }
  return `grid-cols-[${str.replaceAll(" ", "_")}]`;
}

export function Box(props: BoxProps) {
  const { className, style, rest } = useChakraProps(props);
  return <div className={cx(className)} style={style} {...asDivProps(rest)} />;
}

export function Flex(props: BoxProps) {
  const { className, style, rest } = useChakraProps({
    ...props,
    display: "flex",
  });
  return <div className={cx(className)} style={style} {...asDivProps(rest)} />;
}

export function Center(props: BoxProps) {
  const { className, style, rest } = useChakraProps({
    ...props,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  return <div className={cx(className)} style={style} {...asDivProps(rest)} />;
}

export function Container(props: BoxProps) {
  const maxW = props.maxW;
  const { className, style, rest } = useChakraProps({
    ...props,
    maxW: maxW ?? "xl",
    mx: "auto",
    px: "4",
    w: "full",
  });
  return <div className={cx(className)} style={style} {...asDivProps(rest)} />;
}

type StackProps = BoxProps;

export function Stack({
  direction = "column",
  gap = 2,
  align,
  justify,
  wrap,
  ...props
}: StackProps) {
  const { className, style, rest } = useChakraProps({
    ...props,
    display: "flex",
    alignItems: align,
    direction,
    flexWrap: wrap,
    gap,
    justifyContent: justify,
  });
  return <div className={cx(className)} style={style} {...asDivProps(rest)} />;
}

export function HStack({ gap = 2, align = "center", ...props }: StackProps) {
  return <Stack align={align} direction="row" gap={gap} {...props} />;
}

export function VStack({ gap = 2, align = "center", ...props }: StackProps) {
  return <Stack align={align} direction="column" gap={gap} {...props} />;
}

type ResponsiveColumns = string | number | Record<string, string | number>;

function isResponsiveColumns(
  value: ResponsiveColumns | undefined,
): value is Record<string, string | number> {
  return typeof value === "object" && value !== null;
}

export function Grid(
  props: BoxProps & { templateColumns?: ResponsiveColumns },
) {
  const { templateColumns, ...restProps } = props;
  const { className, style, rest } = useChakraProps({
    ...restProps,
    display: "grid",
  });
  const templateClasses = mapResponsiveColumns(
    templateColumns,
    mapTemplateColumns,
  );
  return (
    <div
      className={cx(templateClasses, className)}
      style={style}
      {...asDivProps(rest)}
    />
  );
}

export function GridItem(props: BoxProps) {
  return <Box {...props} />;
}

export function SimpleGrid({
  columns,
  ...props
}: BoxProps & { columns?: ResponsiveColumns }) {
  const columnClasses = mapResponsiveColumns(columns, (v) => {
    const n = String(v);
    if (n.includes(" ")) {
      return n
        .split(" ")
        .map((part) => mapTemplateColumns(part))
        .join(" ");
    }
    return `grid-cols-${n}`;
  });
  const { className, style, rest } = useChakraProps({
    ...props,
    display: "grid",
  });
  return (
    <div
      className={cx(columnClasses, className)}
      style={style}
      {...asDivProps(rest)}
    />
  );
}

function mapResponsiveColumns(
  value: ResponsiveColumns | undefined,
  makeClass: (v: string) => string,
): string {
  if (isResponsiveColumns(value)) {
    const classes: string[] = [];
    for (const [bp, v] of Object.entries(value)) {
      const mapped = makeClass(String(v));
      if (bp === "base") classes.push(mapped);
      else classes.push(`${bp}:${mapped}`);
    }
    return cx(classes);
  }
  if (value === undefined) return "";
  return makeClass(String(value));
}

export function Wrap(props: BoxProps) {
  const { className, style, rest } = useChakraProps({
    ...props,
    display: "flex",
    flexWrap: "wrap",
    gap: 2,
  });
  return <div className={cx(className)} style={style} {...asDivProps(rest)} />;
}

export function Group({
  attached,
  ...props
}: BoxProps & { attached?: boolean }) {
  const { className, style, rest } = useChakraProps({
    ...props,
    display: "inline-flex",
    alignItems: "stretch",
  });
  return (
    <div
      className={cx(
        attached &&
          "[&>button]:first:rounded-l-md [&>button]:last:rounded-r-md [&>button:not(:first-child)]:rounded-l-none [&>button:not(:last-child)]:rounded-r-none [&>input]:first:rounded-l-md [&>input]:last:rounded-r-md [&>input:not(:first-child)]:rounded-l-none [&>input:not(:last-child)]:rounded-r-none",
        className,
      )}
      style={style}
      {...asDivProps(rest)}
    />
  );
}

export function Span(
  props: React.HTMLAttributes<HTMLSpanElement> & ChakraStyleProps,
) {
  const { className, style, rest } = useChakraProps(props);
  return (
    <span className={cx(className)} style={style} {...asSpanProps(rest)} />
  );
}
