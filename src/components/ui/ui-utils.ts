import { clsx, type ClassValue } from "clsx";
import { isValidElement, cloneElement } from "react";
import { twMerge } from "tailwind-merge";

export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Look up a class token in a `satisfies`-validated size map by caller key. */
export function classToken<T extends Record<string, string>>(
  map: T,
  key: string,
  fallback: keyof T,
): string {
  // SAFETY: key is a caller-supplied prop string, not statically bounded to the
  // map's literal key union; the cast keeps indexed access legal while the
  // fallback covers any key absent from the literal map.
  return map[key as keyof T] ?? map[fallback];
}

export function Slot({
  children,
  ...props
}: {
  children: React.ReactNode;
} & Record<string, unknown>): React.ReactNode {
  if (!isValidElement(children)) {
    return null;
  }
  const element = children as React.ReactElement<Record<string, unknown>>;
  return cloneElement(element, {
    ...props,
    className: cx(
      element.props["className"] as string | undefined,
      props["className"] as string | undefined,
    ),
  });
}

type StyleValue = string | number | boolean | undefined | null;
type StyleObject = Record<string, StyleValue>;

function isStyleObject(value: unknown): value is StyleObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapColor(value: string): string {
  if (value === "fg") return "text-neutral-900";
  if (value === "fg.subtle") return "text-neutral-500";
  if (value === "fg.muted") return "text-neutral-400";
  if (value === "border") return "border-neutral-200";
  return value
    .split(".")
    .map((part) => part.replaceAll("_", "-"))
    .join("-");
}

function mapResponsive(
  value: StyleValue | StyleObject,
  makeClass: (v: string) => string,
  breakpoints: string[] = ["sm", "md", "lg", "xl"],
): string[] {
  if (isStyleObject(value)) {
    const breakpointSet = new Set(breakpoints);
    const classes: string[] = [];
    for (const [bp, v] of Object.entries(value)) {
      const className = makeClass(String(v));
      if (bp === "base") {
        classes.push(className);
      } else if (bp.endsWith("Down")) {
        classes.push(`max-${bp.slice(0, -4)}:${className}`);
      } else if (breakpointSet.has(bp)) {
        classes.push(`${bp}:${className}`);
      }
    }
    return classes;
  }
  return value === undefined || value === null || value === ""
    ? []
    : [makeClass(String(value))];
}

function spacing(value: StyleValue | StyleObject): string[] {
  return mapResponsive(value, (v) => {
    if (v === "auto") return "auto";
    return v;
  });
}

function mapSpacingProp(
  key: string,
  value: StyleValue | StyleObject,
  prefix: string,
): string[] {
  const isNegative = key.startsWith("me") && String(value).startsWith("-");
  const raw = isNegative ? String(value).slice(1) : value;
  return spacing(raw).map((s) => `${isNegative ? "-" : ""}${prefix}-${s}`);
}

const HOVERABLE_KEYS = new Set([
  "color",
  "bg",
  "backgroundColor",
  "borderColor",
  "opacity",
  "filter",
]);

function mapFilter(value: string): string {
  const match = value.match(/^brightness\(([\d.]+)\)$/);
  if (match) {
    const percent = Math.round(Number(match[1]) * 100);
    return `brightness-${percent}`;
  }
  return "";
}

function mapVariantClasses(value: StyleObject, prefix: string): string[] {
  const classes: string[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined || v === null || v === "") continue;
    if (!HOVERABLE_KEYS.has(key)) continue;
    const str = String(v);
    if (key === "color") classes.push(`${prefix}:${mapColor(str)}`);
    if (key === "bg" || key === "backgroundColor") {
      classes.push(`${prefix}:bg-${str.split(".").join("-")}`);
    }
    if (key === "borderColor") {
      classes.push(`${prefix}:border-${str.split(".").join("-")}`);
    }
    if (key === "opacity")
      classes.push(`${prefix}:opacity-${Math.round(Number(str) * 100)}`);
    if (key === "filter") {
      const mapped = mapFilter(str);
      if (mapped) classes.push(`${prefix}:${mapped}`);
    }
  }
  return classes;
}

export type ChakraStyleProps = {
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
} & Record<string, unknown>;

export function useChakraProps<P extends ChakraStyleProps>(
  props: P,
): {
  className: string;
  style: React.CSSProperties | undefined;
  // The rest props are re-spread onto polymorphic Ark/native elements whose
  // exact prop types vary per call site; keep them loose in this compat layer.
  // oxlint-disable-next-line typescript/no-explicit-any -- intentional compat shim
  rest: any;
} {
  const classes: string[] = [];
  const rest: Record<string, unknown> = {};
  let style = props.style;
  let hasBorderWidth = false;
  let hasBorderColor = false;

  for (const [key, rawValue] of Object.entries(props)) {
    const value: StyleValue | StyleObject | undefined = rawValue as
      | StyleValue
      | StyleObject
      | undefined;
    if (value === undefined) continue;

    switch (key) {
      case "className": {
        if (typeof value === "string") classes.push(value);
        break;
      }
      case "style": {
        style = value as React.CSSProperties;
        break;
      }
      case "p":
      case "px":
      case "py":
      case "pt":
      case "pb":
      case "ps":
      case "pe":
        classes.push(...mapSpacingProp(key, value, key));
        break;
      case "m":
      case "mx":
      case "my":
      case "mt":
      case "mb":
      case "ms":
      case "me":
        classes.push(...mapSpacingProp(key, value, key));
        break;
      case "w":
      case "width": {
        const mapped = mapResponsive(value, (v) => {
          if (v === "full" || v === "100%") return "w-full";
          if (v === "auto") return "w-auto";
          if (v === "fit") return "w-fit";
          return `w-${v.split(" ").join("_")}`;
        });
        classes.push(...mapped);
        break;
      }
      case "maxW": {
        const mapped = mapResponsive(value, (v) => {
          if (v === "none") return "max-w-none";
          return `max-w-${v.split(" ").join("_")}`;
        });
        classes.push(...mapped);
        break;
      }
      case "minW": {
        classes.push(...mapResponsive(value, (v) => `min-w-${v}`));
        break;
      }
      case "h":
      case "height": {
        const mapped = mapResponsive(value, (v) => {
          if (v === "full" || v === "100%") return "h-full";
          if (v === "auto") return "h-auto";
          if (v.endsWith("px")) return `h-[${v}]`;
          return `h-${v}`;
        });
        classes.push(...mapped);
        break;
      }
      case "minH": {
        classes.push(
          ...mapResponsive(value, (v) => {
            if (v.endsWith("px") || v.includes("(")) {
              return `min-h-[${v.replaceAll(" ", "")}]`;
            }
            return `min-h-${v}`;
          }),
        );
        break;
      }
      case "minHeight": {
        classes.push(
          ...mapResponsive(value, (v) => {
            if (v.endsWith("px") || v.includes("(")) {
              return `min-h-[${v.replaceAll(" ", "")}]`;
            }
            return `min-h-${v}`;
          }),
        );
        break;
      }
      case "maxH": {
        classes.push(
          ...mapResponsive(value, (v) =>
            v.endsWith("px") ? `max-h-[${v}]` : `max-h-${v}`,
          ),
        );
        break;
      }
      case "boxSize": {
        classes.push(...mapResponsive(value, (v) => `h-${v} w-${v}`));
        break;
      }
      case "display": {
        const mapped = mapResponsive(value, (v) => {
          if (v === "flex") return "flex";
          if (v === "none") return "hidden";
          if (v === "block") return "block";
          if (v === "inline-flex") return "inline-flex";
          if (v === "grid") return "grid";
          return v;
        });
        classes.push(...mapped);
        break;
      }
      case "alignItems":
      case "align": {
        const mapped = mapResponsive(value, (v) => {
          if (v === "flex-start") return "items-start";
          if (v === "flex-end") return "items-end";
          if (v === "baseline") return "items-baseline";
          return `items-${v}`;
        });
        classes.push(...mapped);
        break;
      }
      case "justifyContent":
      case "justify": {
        const mapped = mapResponsive(value, (v) => {
          if (v === "flex-start") return "justify-start";
          if (v === "flex-end") return "justify-end";
          if (v === "space-between") return "justify-between";
          if (v === "space-around") return "justify-around";
          return `justify-${v}`;
        });
        classes.push(...mapped);
        break;
      }
      case "flex": {
        if (value === "1" || value === 1) classes.push("flex-1");
        else if (typeof value === "string") classes.push(`flex-[${value}]`);
        else if (typeof value === "number") classes.push(`flex-[${value}]`);
        break;
      }
      case "flexShrink": {
        classes.push(
          ...mapResponsive(value, (v) =>
            Number(v) === 0 ? "shrink-0" : "shrink",
          ),
        );
        break;
      }
      case "flexGrow": {
        classes.push(
          ...mapResponsive(value, (v) => (Number(v) === 0 ? "grow-0" : "grow")),
        );
        break;
      }
      case "alignSelf": {
        classes.push(
          ...mapResponsive(value, (v) => {
            if (v === "flex-start") return "self-start";
            if (v === "flex-end") return "self-end";
            return `self-${v}`;
          }),
        );
        break;
      }
      case "direction": {
        classes.push(
          ...mapResponsive(value, (v) =>
            v === "row" ? "flex-row" : "flex-col",
          ),
        );
        break;
      }
      case "flexWrap":
      case "wrap": {
        classes.push(
          ...mapResponsive(value, (v) =>
            v === "wrap" ? "flex-wrap" : "flex-nowrap",
          ),
        );
        break;
      }
      case "gap": {
        classes.push(...mapResponsive(value, (v) => `gap-${v}`));
        break;
      }
      case "position": {
        classes.push(...mapResponsive(value, (v) => v));
        break;
      }
      case "top":
      case "left":
      case "right":
      case "bottom": {
        classes.push(...mapResponsive(value, (v) => `${key}-${v}`));
        break;
      }
      case "zIndex": {
        classes.push(...mapResponsive(value, (v) => `z-${v}`));
        break;
      }
      case "aspectRatio": {
        classes.push(
          ...mapResponsive(value, (v) => {
            if (v === "square") return "aspect-square";
            if (v === "16 / 9") return "aspect-video";
            if (v === "4 / 3") return "aspect-4/3";
            return `aspect-[${v}]`;
          }),
        );
        break;
      }
      case "objectFit": {
        classes.push(...mapResponsive(value, (v) => `object-${v}`));
        break;
      }
      case "overflow": {
        classes.push(...mapResponsive(value, (v) => `overflow-${v}`));
        break;
      }
      case "overflowY": {
        classes.push(...mapResponsive(value, (v) => `overflow-y-${v}`));
        break;
      }
      case "overflowX": {
        classes.push(...mapResponsive(value, (v) => `overflow-x-${v}`));
        break;
      }
      case "cursor": {
        classes.push(...mapResponsive(value, (v) => `cursor-${v}`));
        break;
      }
      case "transition": {
        if (typeof value === "string" && value.includes("transform")) {
          classes.push("transition-transform", "duration-200");
        } else if (typeof value === "string" && value.includes("color")) {
          classes.push("transition-colors", "duration-200");
        } else {
          classes.push("transition-all", "duration-200");
        }
        break;
      }
      case "transitionProperty": {
        classes.push(
          ...mapResponsive(value, (v) => {
            if (v === "all") return "transition-all";
            if (v === "colors") return "transition-colors";
            if (v === "transform") return "transition-transform";
            if (v === "opacity") return "transition-opacity";
            return "transition-all";
          }),
        );
        break;
      }
      case "transitionDuration": {
        const mapped = mapResponsive(value, (v) => {
          if (v === "200ms") return "duration-200";
          if (v === "300ms") return "duration-300";
          return "duration-200";
        });
        classes.push(...mapped);
        break;
      }
      case "rounded":
      case "borderRadius": {
        classes.push(...mapResponsive(value, (v) => `rounded-${v}`));
        break;
      }
      case "border": {
        if (value === "0" || value === "none") {
          classes.push("border-0");
        } else if (String(value).includes("4")) {
          classes.push("border-4");
          hasBorderWidth = true;
        } else {
          classes.push("border");
          hasBorderWidth = true;
        }
        break;
      }
      case "borderTop": {
        if (value === "0" || value === "none") classes.push("border-t-0");
        else {
          classes.push("border-t");
          hasBorderWidth = true;
        }
        break;
      }
      case "borderBottom": {
        if (value === "0" || value === "none") classes.push("border-b-0");
        else {
          classes.push("border-b");
          hasBorderWidth = true;
        }
        break;
      }
      case "borderLeft": {
        if (value === "0" || value === "none") classes.push("border-l-0");
        else {
          classes.push("border-l");
          hasBorderWidth = true;
        }
        break;
      }
      case "borderRight": {
        if (value === "0" || value === "none") classes.push("border-r-0");
        else {
          classes.push("border-r");
          hasBorderWidth = true;
        }
        break;
      }
      case "borderColor": {
        hasBorderColor = true;
        classes.push(
          ...mapResponsive(
            value,
            (v) => `border-${mapColor(v).replace("text-", "")}`,
          ),
        );
        break;
      }
      case "bg":
      case "backgroundColor": {
        classes.push(
          ...mapResponsive(value, (v) => `bg-${v.split(".").join("-")}`),
        );
        break;
      }
      case "shadow": {
        classes.push(...mapResponsive(value, (v) => `shadow-${v}`));
        break;
      }
      case "color": {
        classes.push(...mapResponsive(value, (v) => mapColor(v)));
        break;
      }
      case "fontSize": {
        classes.push(...mapResponsive(value, (v) => `text-${v}`));
        break;
      }
      case "fontWeight": {
        classes.push(
          ...mapResponsive(value, (v) => {
            if (v === "bold") return "font-bold";
            if (v === "medium") return "font-medium";
            if (v === "semibold") return "font-semibold";
            return `font-${v}`;
          }),
        );
        break;
      }
      case "fontStyle": {
        classes.push(
          ...mapResponsive(value, (v) =>
            v === "italic" ? "italic" : `not-italic`,
          ),
        );
        break;
      }
      case "textAlign": {
        classes.push(
          ...mapResponsive(value, (v) => {
            if (v === "end") return "text-right";
            if (v === "start") return "text-left";
            return `text-${v}`;
          }),
        );
        break;
      }
      case "textStyle": {
        classes.push(...mapResponsive(value, (v) => `text-${v}`));
        break;
      }
      case "lineClamp": {
        classes.push(...mapResponsive(value, (v) => `line-clamp-${v}`));
        break;
      }
      case "opacity": {
        classes.push(
          ...mapResponsive(
            value,
            (v) => `opacity-${Math.round(Number(v) * 100)}`,
          ),
        );
        break;
      }
      case "_hover": {
        if (isStyleObject(value))
          classes.push(...mapVariantClasses(value, "hover"));
        break;
      }
      case "_groupHover": {
        if (isStyleObject(value))
          classes.push(...mapVariantClasses(value, "group-hover"));
        break;
      }
      case "transform": {
        if (typeof value === "string") {
          style = { ...style, transform: value };
        }
        break;
      }
      default: {
        rest[key] = rawValue;
      }
    }
  }

  if (hasBorderWidth && !hasBorderColor) {
    classes.push("border-gray-200 dark:border-gray-700");
  }

  return { className: cx(classes), style, rest };
}
