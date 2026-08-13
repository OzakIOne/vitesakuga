import {
  Collapsible as ArkCollapsible,
  Combobox as ArkCombobox,
  Dialog as ArkDialog,
  FileUpload as ArkFileUpload,
  Menu as ArkMenu,
  Popover as ArkPopover,
  Select as ArkSelect,
  Slider as ArkSlider,
  useCollapsibleContext,
  useFileUploadContext,
  type ListCollection,
} from "@ark-ui/react";
import * as React from "react";
import { LuCheck, LuChevronDown, LuX } from "react-icons/lu";

import { cx, useChakraProps, type ChakraStyleProps } from "./ui-utils";

const DIALOG_CONTENT_BASE =
  "relative z-50 w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

export const Dialog = {
  Root: (props: React.ComponentProps<typeof ArkDialog.Root>) => (
    <ArkDialog.Root {...props} />
  ),
  Trigger: (props: React.ComponentProps<typeof ArkDialog.Trigger>) => (
    <ArkDialog.Trigger {...props} />
  ),
  Backdrop: (
    props: React.ComponentProps<typeof ArkDialog.Backdrop> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkDialog.Backdrop
        className={cx("fixed inset-0 z-50 bg-black/50", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkDialog.Backdrop>)}
      />
    );
  },
  Positioner: (
    props: React.ComponentProps<typeof ArkDialog.Positioner> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkDialog.Positioner
        className={cx(
          "fixed inset-0 z-50 flex items-center justify-center p-4",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkDialog.Positioner>)}
      />
    );
  },
  Content: (
    props: React.ComponentProps<typeof ArkDialog.Content> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkDialog.Content
        className={cx(DIALOG_CONTENT_BASE, className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkDialog.Content>)}
      />
    );
  },
  Header: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <div
        className={cx(
          "mb-4 flex items-center justify-between gap-4",
          className,
        )}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  Title: (
    props: React.ComponentProps<typeof ArkDialog.Title> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkDialog.Title
        className={cx("text-lg font-semibold", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkDialog.Title>)}
      />
    );
  },
  Description: (
    props: React.ComponentProps<typeof ArkDialog.Description> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkDialog.Description
        className={cx("text-sm text-gray-600 dark:text-gray-300", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkDialog.Description>)}
      />
    );
  },
  Body: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <div
        className={cx("text-sm text-gray-700 dark:text-gray-300", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  Footer: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <div
        className={cx("mt-4 flex justify-end gap-2", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  CloseTrigger: (
    props: React.ComponentProps<typeof ArkDialog.CloseTrigger> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkDialog.CloseTrigger
        aria-label="Close dialog"
        className={cx(
          "absolute top-4 right-4 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkDialog.CloseTrigger>)}
      >
        {props.children ?? <LuX />}
      </ArkDialog.CloseTrigger>
    );
  },
  ActionTrigger: (
    props: React.ComponentProps<typeof ArkDialog.CloseTrigger>,
  ) => <ArkDialog.CloseTrigger {...props} />,
};

export const Menu = {
  Root: (props: React.ComponentProps<typeof ArkMenu.Root>) => (
    <ArkMenu.Root {...props} />
  ),
  Trigger: (props: React.ComponentProps<typeof ArkMenu.Trigger>) => (
    <ArkMenu.Trigger {...props} />
  ),
  Positioner: (
    props: React.ComponentProps<typeof ArkMenu.Positioner> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkMenu.Positioner
        className={cx("z-50", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkMenu.Positioner>)}
      />
    );
  },
  Content: (
    props: React.ComponentProps<typeof ArkMenu.Content> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkMenu.Content
        className={cx(
          "min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkMenu.Content>)}
      />
    );
  },
  Item: (
    props: React.ComponentProps<typeof ArkMenu.Item> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkMenu.Item
        className={cx(
          "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 data-[highlighted]:bg-gray-100 dark:hover:bg-gray-700 dark:data-[highlighted]:bg-gray-700",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkMenu.Item>)}
      />
    );
  },
  Separator: (props: React.ComponentProps<typeof ArkMenu.Separator>) => (
    <ArkMenu.Separator
      className="my-1 h-px bg-gray-200 dark:bg-gray-700"
      {...props}
    />
  ),
};

export const Popover = {
  Root: (props: React.ComponentProps<typeof ArkPopover.Root>) => (
    <ArkPopover.Root {...props} />
  ),
  Trigger: (props: React.ComponentProps<typeof ArkPopover.Trigger>) => (
    <ArkPopover.Trigger {...props} />
  ),
  Positioner: (
    props: React.ComponentProps<typeof ArkPopover.Positioner> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkPopover.Positioner
        className={cx("z-50", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkPopover.Positioner>)}
      />
    );
  },
  Content: (
    props: React.ComponentProps<typeof ArkPopover.Content> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkPopover.Content
        className={cx(
          "rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkPopover.Content>)}
      />
    );
  },
  Arrow: (props: React.ComponentProps<typeof ArkPopover.Arrow>) => (
    <ArkPopover.Arrow className="text-gray-200 dark:text-gray-700" {...props} />
  ),
  ArrowTip: ArkPopover.ArrowTip,
  Body: (props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <div
        className={cx("text-sm text-gray-700 dark:text-gray-300", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
};

export const Collapsible = {
  Root: (props: React.ComponentProps<typeof ArkCollapsible.Root>) => (
    <ArkCollapsible.Root {...props} />
  ),
  Trigger: (
    props: React.ComponentProps<typeof ArkCollapsible.Trigger> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCollapsible.Trigger
        className={cx("cursor-pointer text-left", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCollapsible.Trigger>)}
      />
    );
  },
  Content: (
    props: React.ComponentProps<typeof ArkCollapsible.Content> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCollapsible.Content
        className={cx("mt-2", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCollapsible.Content>)}
      />
    );
  },
};

export { useCollapsibleContext };

const LIST_BASE =
  "flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

export const Combobox = {
  Root: (
    props: Omit<React.ComponentProps<typeof ArkCombobox.Root>, "collection"> & {
      // oxlint-disable-next-line typescript/no-explicit-any -- compat layer accepts any collection type
      collection: ListCollection<any>;
    } & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCombobox.Root
        className={cx("w-full", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCombobox.Root>)}
      />
    );
  },
  Control: (
    props: React.ComponentProps<typeof ArkCombobox.Control> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCombobox.Control
        className={cx("relative", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCombobox.Control>)}
      />
    );
  },
  Input: (
    props: React.ComponentProps<typeof ArkCombobox.Input> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCombobox.Input
        className={cx(LIST_BASE, "pe-10", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCombobox.Input>)}
      />
    );
  },
  IndicatorGroup: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span
      className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center"
      {...props}
    />
  ),
  Trigger: (props: React.ComponentProps<typeof ArkCombobox.Trigger>) => (
    <ArkCombobox.Trigger
      aria-label="Open options"
      className="flex items-center text-gray-500"
      {...props}
    >
      <LuChevronDown />
    </ArkCombobox.Trigger>
  ),
  Positioner: (
    props: React.ComponentProps<typeof ArkCombobox.Positioner> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCombobox.Positioner
        className={cx("z-50", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCombobox.Positioner>)}
      />
    );
  },
  Content: (
    props: React.ComponentProps<typeof ArkCombobox.Content> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCombobox.Content
        className={cx(
          "mt-1 max-h-60 w-[var(--reference-width)] overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCombobox.Content>)}
      />
    );
  },
  ItemGroup: (props: React.ComponentProps<typeof ArkCombobox.ItemGroup>) => (
    <ArkCombobox.ItemGroup className="py-0.5" {...props} />
  ),
  Item: (
    props: React.ComponentProps<typeof ArkCombobox.Item> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCombobox.Item
        className={cx(
          "flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100 dark:hover:bg-gray-700 dark:data-[highlighted]:bg-gray-700",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCombobox.Item>)}
      />
    );
  },
  ItemIndicator: (
    props: React.ComponentProps<typeof ArkCombobox.ItemIndicator>,
  ) => (
    <ArkCombobox.ItemIndicator className="text-blue-600" {...props}>
      <LuCheck />
    </ArkCombobox.ItemIndicator>
  ),
  Empty: (
    props: React.ComponentProps<typeof ArkCombobox.Empty> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkCombobox.Empty
        className={cx("px-2 py-1.5 text-sm text-gray-500", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkCombobox.Empty>)}
      />
    );
  },
};

export const Select = {
  Root: (
    props: Omit<React.ComponentProps<typeof ArkSelect.Root>, "collection"> & {
      // oxlint-disable-next-line typescript/no-explicit-any -- compat layer accepts any collection type
      collection: ListCollection<any>;
    } & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.Root
        className={cx("w-full", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.Root>)}
      />
    );
  },
  Label: (
    props: React.ComponentProps<typeof ArkSelect.Label> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.Label
        className={cx(
          "mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.Label>)}
      />
    );
  },
  Control: (
    props: React.ComponentProps<typeof ArkSelect.Control> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.Control
        className={cx("relative", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.Control>)}
      />
    );
  },
  Trigger: (
    props: React.ComponentProps<typeof ArkSelect.Trigger> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.Trigger
        className={cx(LIST_BASE, "h-10", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.Trigger>)}
      >
        <LuChevronDown className="text-gray-500" />
      </ArkSelect.Trigger>
    );
  },
  ValueText: (
    props: React.ComponentProps<typeof ArkSelect.ValueText> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.ValueText
        className={cx(
          "text-gray-900 placeholder:text-gray-400 dark:text-gray-100",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.ValueText>)}
      />
    );
  },
  IndicatorGroup: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span className="flex items-center" {...props} />
  ),
  Indicator: (props: React.ComponentProps<typeof ArkSelect.Indicator>) => (
    <ArkSelect.Indicator className="text-gray-500" {...props} />
  ),
  Positioner: (
    props: React.ComponentProps<typeof ArkSelect.Positioner> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.Positioner
        className={cx("z-50", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.Positioner>)}
      />
    );
  },
  Content: (
    props: React.ComponentProps<typeof ArkSelect.Content> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.Content
        className={cx(
          "mt-1 max-h-60 w-[var(--reference-width)] overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.Content>)}
      />
    );
  },
  Item: (
    props: React.ComponentProps<typeof ArkSelect.Item> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSelect.Item
        className={cx(
          "flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:hover:bg-gray-700 dark:data-[highlighted]:bg-gray-700",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSelect.Item>)}
      />
    );
  },
  ItemIndicator: (
    props: React.ComponentProps<typeof ArkSelect.ItemIndicator>,
  ) => (
    <ArkSelect.ItemIndicator className="text-blue-600" {...props}>
      <LuCheck />
    </ArkSelect.ItemIndicator>
  ),
};

export const Slider = {
  Root: (
    props: React.ComponentProps<typeof ArkSlider.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSlider.Root
        className={cx("w-full touch-none select-none", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSlider.Root>)}
      />
    );
  },
  Label: (
    props: React.ComponentProps<typeof ArkSlider.Label> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSlider.Label
        className={cx("text-sm font-medium", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSlider.Label>)}
      />
    );
  },
  ValueText: (
    props: React.ComponentProps<typeof ArkSlider.ValueText> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSlider.ValueText
        className={cx("text-sm text-gray-500", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSlider.ValueText>)}
      />
    );
  },
  Control: (
    props: React.ComponentProps<typeof ArkSlider.Control> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSlider.Control
        className={cx("relative flex h-6 items-center", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSlider.Control>)}
      />
    );
  },
  Track: (
    props: React.ComponentProps<typeof ArkSlider.Track> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSlider.Track
        className={cx(
          "relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSlider.Track>)}
      />
    );
  },
  Range: (
    props: React.ComponentProps<typeof ArkSlider.Range> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSlider.Range
        className={cx("absolute h-full rounded-full bg-blue-600", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSlider.Range>)}
      />
    );
  },
  Thumb: (
    props: React.ComponentProps<typeof ArkSlider.Thumb> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkSlider.Thumb
        className={cx(
          "block h-4 w-4 rounded-full border border-gray-300 bg-white shadow-sm",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkSlider.Thumb>)}
      />
    );
  },
  HiddenInput: ArkSlider.HiddenInput,
};

export const FileUpload = {
  Root: (
    props: React.ComponentProps<typeof ArkFileUpload.Root> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkFileUpload.Root
        className={cx("flex w-full flex-col", className)}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkFileUpload.Root>)}
      />
    );
  },
  HiddenInput: ArkFileUpload.HiddenInput,
  Label: (props: React.ComponentProps<typeof ArkFileUpload.Label>) => (
    <ArkFileUpload.Label {...props} />
  ),
  Trigger: (props: React.ComponentProps<typeof ArkFileUpload.Trigger>) => (
    <ArkFileUpload.Trigger {...props} />
  ),
  Dropzone: (
    props: React.ComponentProps<typeof ArkFileUpload.Dropzone> &
      ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <ArkFileUpload.Dropzone
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition-colors hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500 dark:hover:bg-gray-700",
          className,
        )}
        style={style}
        {...(rest as React.ComponentProps<typeof ArkFileUpload.Dropzone>)}
      />
    );
  },
  DropzoneContent: (
    props: React.HTMLAttributes<HTMLDivElement> & ChakraStyleProps,
  ) => {
    const { className, style, rest } = useChakraProps(props);
    return (
      <div
        className={cx("flex flex-col items-center gap-1", className)}
        style={style}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  },
  List: ({
    clearable,
    showSize,
    className,
    ...props
  }: {
    clearable?: boolean;
    showSize?: boolean;
  } & React.HTMLAttributes<HTMLDivElement>) => {
    const api = useFileUploadContext();
    const files = api.acceptedFiles;
    if (files.length === 0) return null;
    return (
      <div className={cx("mt-2 w-full", className)} {...props}>
        <ArkFileUpload.ItemGroup className="space-y-2">
          {files.map((file) => (
            <ArkFileUpload.Item
              className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              file={file}
              key={file.name}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ArkFileUpload.ItemName className="truncate font-medium" />
                {showSize && (
                  <ArkFileUpload.ItemSizeText className="shrink-0 text-xs text-gray-500" />
                )}
              </span>
              <ArkFileUpload.ItemDeleteTrigger
                aria-label={`Remove ${file.name}`}
                className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600"
              >
                <LuX />
              </ArkFileUpload.ItemDeleteTrigger>
            </ArkFileUpload.Item>
          ))}
        </ArkFileUpload.ItemGroup>
        {clearable && (
          <ArkFileUpload.ClearTrigger className="mt-2 text-sm text-blue-600 hover:underline">
            Clear all
          </ArkFileUpload.ClearTrigger>
        )}
      </div>
    );
  },
};
