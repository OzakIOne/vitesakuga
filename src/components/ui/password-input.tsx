"use client";

import * as React from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

import { IconButton } from "./button";
import { Input } from "./field";
import { cx } from "./ui-utils";

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }
  };
}

function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value: T | undefined;
  defaultValue: T | undefined;
  onChange: ((value: T) => void) | undefined;
}): [T, (value: T) => void] {
  const [internal, setInternal] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const setValue = (next: T) => {
    if (!isControlled) {
      setInternal(next);
    }
    onChange?.(next);
  };
  return [current as T, setValue];
}

export type PasswordVisibilityProps = {
  defaultVisible?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  visibilityIcon?: { on: React.ReactNode; off: React.ReactNode };
};

export type PasswordInputProps = {
  rootProps?: React.HTMLAttributes<HTMLDivElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  PasswordVisibilityProps;

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(function PasswordInput(props, ref) {
  const {
    rootProps,
    defaultVisible,
    visible: visibleProp,
    onVisibleChange,
    visibilityIcon = { off: <LuEyeOff />, on: <LuEye /> },
    className,
    disabled,
    ...rest
  } = props;

  const [visible, setVisible] = useControllableState({
    defaultValue: defaultVisible,
    onChange: onVisibleChange,
    value: visibleProp,
  });

  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={cx("relative w-full", rootProps?.className)} {...rootProps}>
      <Input
        {...rest}
        className={cx("pe-10", className)}
        disabled={disabled}
        ref={mergeRefs(ref, inputRef)}
        type={visible ? "text" : "password"}
      />
      <IconButton
        aria-label="Toggle password visibility"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        disabled={disabled}
        onPointerDown={(e) => {
          if (disabled) {
            return;
          }
          if (e.button !== 0) {
            return;
          }
          e.preventDefault();
          setVisible(!visible);
        }}
        size="sm"
        tabIndex={-1}
        type="button"
        variant="ghost"
      >
        {visible ? visibilityIcon.off : visibilityIcon.on}
      </IconButton>
    </div>
  );
});

type PasswordStrengthMeterProps = {
  max?: number;
  value: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const PasswordStrengthMeter = React.forwardRef<
  HTMLDivElement,
  PasswordStrengthMeterProps
>(function PasswordStrengthMeter(props, ref) {
  const { max = 4, value, ...rest } = props;
  const percent = (value / max) * 100;
  const { colorClass, label } = getColorPalette(percent);

  return (
    <div className="flex w-full flex-col gap-1" ref={ref} {...rest}>
      <div className="flex w-full gap-1">
        {Array.from({ length: max }).map((_, index) => (
          <div
            className={cx(
              "h-1 flex-1 rounded-sm bg-gray-200",
              index < value ? colorClass : undefined,
            )}
            key={index}
          />
        ))}
      </div>
      {label && <div className="text-xs">{label}</div>}
    </div>
  );
});

function getColorPalette(percent: number) {
  if (percent < 33) {
    return { colorClass: "bg-red-500", label: "Low" };
  }
  if (percent < 66) {
    return { colorClass: "bg-orange-500", label: "Medium" };
  }
  return { colorClass: "bg-green-500", label: "High" };
}
