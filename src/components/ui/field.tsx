import { Checkbox as ArkCheckbox, Field as ArkField } from "@ark-ui/react";
import * as React from "react";
import { LuCheck } from "react-icons/lu";

import { cx, useChakraProps, type ChakraStyleProps } from "./ui-utils";

export const Field = {
  Root: (
    props: React.ComponentProps<typeof ArkField.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkField.Root
        className={cx("flex w-full flex-col gap-1.5", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkField.Root>)}
      />
    );
  },
  Label: (
    props: React.ComponentProps<typeof ArkField.Label> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkField.Label
        className={cx(
          "text-sm font-medium text-gray-800 dark:text-gray-200",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkField.Label>)}
      />
    );
  },
  RequiredIndicator: (
    props: React.ComponentProps<typeof ArkField.RequiredIndicator> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkField.RequiredIndicator
        className={cx("text-red-500", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkField.RequiredIndicator>)}
      />
    );
  },
  HelperText: (
    props: React.ComponentProps<typeof ArkField.HelperText> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkField.HelperText
        className={cx("text-xs text-gray-500", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkField.HelperText>)}
      />
    );
  },
  ErrorText: (
    props: React.ComponentProps<typeof ArkField.ErrorText> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkField.ErrorText
        className={cx("text-xs text-red-600", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkField.ErrorText>)}
      />
    );
  },
};

const INPUT_SIZES: Record<string, string> = {
  xs: "h-7 px-2 text-xs",
  sm: "h-8 px-2.5 text-sm",
  md: "h-10 px-3 text-sm",
  lg: "h-12 px-4 text-base",
};

const INPUT_BASE =
  "w-full rounded-md border border-gray-300 bg-white text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

type InputProps = {
  size?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  ChakraStyleProps;

export function Input({ size = "md", ...props }: InputProps) {
  const { className, style, rest } = useChakraProps(props);
  return (
    <input
      className={cx(
        INPUT_BASE,
        INPUT_SIZES[size] ?? INPUT_SIZES["md"],
        className,
      )}
      style={style}
      {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
    />
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  ChakraStyleProps;

export function Textarea(props: TextareaProps) {
  const { className, style, rest } = useChakraProps(props);
  return (
    <textarea
      className={cx(INPUT_BASE, "min-h-20 resize-y px-3 py-2", className)}
      style={style}
      {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
    />
  );
}

type InputGroupProps = {
  startElement?: React.ReactNode;
  endElement?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement> &
  ChakraStyleProps;

export function InputGroup({
  startElement,
  endElement,
  children,
  ...props
}: InputGroupProps) {
  const { className, style, rest } = useChakraProps(props);
  const child = React.Children.only(children) as React.ReactElement<{
    className?: string;
  }>;
  const childWithPadding = React.cloneElement(child, {
    className: cx(
      child.props.className,
      startElement ? "ps-10" : undefined,
      endElement ? "pe-10" : undefined,
    ),
  });
  return (
    <div
      className={cx("relative flex w-full items-center", className)}
      style={style}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    >
      {startElement && (
        <span className="pointer-events-none absolute start-3 top-1/2 z-10 -translate-y-1/2 text-gray-500">
          {startElement}
        </span>
      )}
      {childWithPadding}
      {endElement && (
        <span className="absolute end-2 top-1/2 z-10 -translate-y-1/2">
          {endElement}
        </span>
      )}
    </div>
  );
}

export const Checkbox = {
  Root: (
    props: React.ComponentProps<typeof ArkCheckbox.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCheckbox.Root
        className={cx(
          "group inline-flex cursor-pointer items-center gap-2",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCheckbox.Root>)}
      />
    );
  },
  HiddenInput: ArkCheckbox.HiddenInput,
  Control: (
    props: React.ComponentProps<typeof ArkCheckbox.Control> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCheckbox.Control
        className={cx(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 bg-white transition-colors data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 group-hover:border-gray-400",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCheckbox.Control>)}
      />
    );
  },
  Indicator: (props: React.ComponentProps<typeof ArkCheckbox.Indicator>) => (
    <ArkCheckbox.Indicator className="text-white" {...props}>
      <LuCheck className="h-3 w-3" />
    </ArkCheckbox.Indicator>
  ),
  Label: (
    props: React.ComponentProps<typeof ArkCheckbox.Label> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCheckbox.Label
        className={cx("text-sm", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCheckbox.Label>)}
      />
    );
  },
};
