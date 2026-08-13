import { Avatar as ArkAvatar } from "@ark-ui/react";
import * as React from "react";

import { cx, useChakraProps, type ChakraStyleProps } from "./ui-utils";

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & ChakraStyleProps;

export function Image(props: ImageProps) {
  const { className, style, rest } = useChakraProps(props);
  return (
    <img
      className={cx(className)}
      style={style}
      {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
}

const AVATAR_SIZES: Record<string, string> = {
  "2xl": "h-24 w-24 text-4xl",
  xl: "h-16 w-16 text-2xl",
  lg: "h-12 w-12 text-xl",
  md: "h-10 w-10 text-lg",
  sm: "h-8 w-8 text-base",
  xs: "h-6 w-6 text-xs",
};

export const Avatar = {
  Root: (
    props: React.ComponentProps<typeof ArkAvatar.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    const size = (props["size"] as string | undefined) ?? "md";
    return (
      <ArkAvatar.Root
        className={cx(
          "relative inline-flex shrink-0 overflow-hidden rounded-full bg-gray-200",
          AVATAR_SIZES[size] ?? AVATAR_SIZES["md"],
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkAvatar.Root>)}
      />
    );
  },
  Image: (
    props: React.ComponentProps<typeof ArkAvatar.Image> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkAvatar.Image
        className={cx("h-full w-full object-cover", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkAvatar.Image>)}
      />
    );
  },
  Fallback: (
    props: React.ComponentProps<typeof ArkAvatar.Fallback> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkAvatar.Fallback
        className={cx(
          "flex h-full w-full items-center justify-center bg-gray-200 font-medium text-gray-700",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkAvatar.Fallback>)}
      />
    );
  },
};

export function AvatarGroup(
  props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps,
) {
  const { className, style, rest } = useChakraProps(props);
  return (
    <div
      className={cx("flex items-center -space-x-2", className)}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    />
  );
}

export const Card = {
  Root: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <div
        className={cx(
          "rounded-lg border border-gray-200 bg-white shadow-sm",
          className,
        )}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  Body: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <div
        className={cx("p-4", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
};
