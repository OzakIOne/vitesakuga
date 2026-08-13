import { Portal, Tooltip as ArkTooltip } from "@ark-ui/react";
import * as React from "react";

import { cx } from "./ui-utils";

export type TooltipProps = {
  showArrow?: boolean;
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  content: React.ReactNode;
  contentProps?: React.ComponentProps<typeof ArkTooltip.Content>;
  disabled?: boolean;
} & React.ComponentProps<typeof ArkTooltip.Root>;

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(props, ref) {
    const {
      showArrow,
      children,
      disabled,
      portalled = true,
      content,
      contentProps,
      portalRef,
      ...rest
    } = props;

    if (disabled) {
      return children;
    }

    return (
      <ArkTooltip.Root {...rest}>
        <ArkTooltip.Trigger asChild>{children}</ArkTooltip.Trigger>
        <Portal container={portalRef} disabled={!portalled}>
          <ArkTooltip.Positioner className="z-50">
            <ArkTooltip.Content
              className={cx(
                "rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900",
                contentProps?.className,
              )}
              ref={ref}
              {...contentProps}
            >
              {showArrow && (
                <ArkTooltip.Arrow className="text-gray-900 dark:text-gray-100">
                  <ArkTooltip.ArrowTip />
                </ArkTooltip.Arrow>
              )}
              {content}
            </ArkTooltip.Content>
          </ArkTooltip.Positioner>
        </Portal>
      </ArkTooltip.Root>
    );
  },
);
