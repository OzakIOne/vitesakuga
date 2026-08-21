import { Avatar as ArkAvatar } from "@ark-ui/react";
import * as React from "react";

import {
  classToken,
  cx,
  useChakraProps,
  type ChakraStyleProps,
} from "./ui-utils";

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & ChakraStyleProps;

export function Image({ alt, ...props }: ImageProps) {
  const { className, style, rest } = useChakraProps(props);
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
  return (
    <img
      alt={alt ?? ""}
      className={cx(className)}
      style={style}
      {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );
}

type AvatarSize = "2xl" | "xl" | "lg" | "md" | "sm" | "xs";

const AVATAR_SIZES = {
  "2xl": "h-24 w-24 text-4xl",
  xl: "h-16 w-16 text-2xl",
  lg: "h-12 w-12 text-xl",
  md: "h-10 w-10 text-lg",
  sm: "h-8 w-8 text-base",
  xs: "h-6 w-6 text-xs",
} satisfies Record<AvatarSize, string>;

export const Avatar = {
  Root: (
    props: React.ComponentProps<typeof ArkAvatar.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: size comes from a caller-supplied prop; the fallback covers keys absent from the literal size map, keeping the lookup total.
    const size = (props["size"] as string | undefined) ?? "md";
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
    return (
      <ArkAvatar.Root
        className={cx(
          "relative inline-flex shrink-0 overflow-hidden rounded-full bg-gray-200",
          classToken(AVATAR_SIZES, size, "md"),
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
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
    return (
      <ArkAvatar.Image
        className={cx("h-full w-full object-cover", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkAvatar.Image>)}
      />
    );
  },
  Fallback: (
    props: React.ComponentProps<typeof ArkAvatar.Fallback> &
      ChakraStyleProps & { name?: string },
  ) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed Ark component.
    return (
      <ArkAvatar.Fallback
        className={cx(
          "flex h-full w-full items-center justify-center bg-gray-200 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200",
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
  // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
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
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <div
        className={cx(
          "rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800",
          className,
        )}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  Body: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    // SAFETY: useChakraProps strips Chakra style props into className/style; remaining rest props spread onto the typed native element.
    return (
      <div
        className={cx("p-4", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
};
