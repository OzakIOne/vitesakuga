"use client";

import { PasswordInput as ArkPasswordInput } from "@ark-ui/react/password-input";
import { passwordStrength } from "check-password-strength";
import * as React from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { PASSWORD_STRENGTH_OPTIONS } from "src/lib/auth/password-policy";

import { INPUT_BASE, INPUT_SIZES } from "./field";
import { cx } from "./ui-utils";

export type PasswordVisibilityProps = {
  defaultVisible?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  visibilityIcon?: { on: React.ReactNode; off: React.ReactNode };
};

export type PasswordInputProps = {
  rootProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Marks the input as invalid (sets `aria-invalid` and `data-invalid`). */
  invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type"> &
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
    autoComplete,
    className,
    disabled,
    invalid,
    readOnly,
    required,
    ...rest
  } = props;

  // SAFETY: rootProps are pre-typed Ark props spread onto the Root; autoComplete
  // narrows the caller-provided string to the only values Ark accepts.
  return (
    <ArkPasswordInput.Root
      {...(rootProps as React.ComponentProps<typeof ArkPasswordInput.Root>)}
      autoComplete={
        autoComplete as "current-password" | "new-password" | undefined
      }
      className={cx("relative w-full", rootProps?.className)}
      defaultVisible={defaultVisible}
      disabled={disabled}
      invalid={invalid}
      onVisibilityChange={
        onVisibleChange ? ({ visible }) => onVisibleChange(visible) : undefined
      }
      readOnly={readOnly}
      required={required}
      visible={visibleProp}
    >
      <ArkPasswordInput.Control>
        <ArkPasswordInput.Input
          {...rest}
          className={cx(INPUT_BASE, INPUT_SIZES["md"], "pe-10", className)}
          ref={ref}
        />
        <ArkPasswordInput.VisibilityTrigger
          aria-label="Toggle password visibility"
          className="absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-700 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-400/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <ArkPasswordInput.Indicator fallback={visibilityIcon.on}>
            {visibilityIcon.off}
          </ArkPasswordInput.Indicator>
        </ArkPasswordInput.VisibilityTrigger>
      </ArkPasswordInput.Control>
    </ArkPasswordInput.Root>
  );
});

/**
 * Invisible account identifier for password-only forms (change password,
 * confirmation dialogs). Chromium's password-form heuristics expect every
 * password form to include a username field; see
 * https://www.chromium.org/developers/design-documents/create-amazing-password-forms/
 */
export function HiddenUsernameField({
  name = "username",
  value,
}: {
  name?: string;
  /** Account identifier (email or username) known by the caller, if any. */
  value?: string;
}) {
  return (
    <input
      autoComplete="username"
      hidden
      name={name}
      readOnly
      tabIndex={-1}
      type="text"
      value={value ?? ""}
    />
  );
}

const STRENGTH_OPTIONS = PASSWORD_STRENGTH_OPTIONS;
export type PasswordStrengthResult = {
  /** 0 for an empty password, otherwise 1 (weak) to 4 (strong). */
  score: number;
  level: string;
};

export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (password.length === 0) {
    return { score: 0, level: "weak" };
  }
  const { id, value } = passwordStrength(password, STRENGTH_OPTIONS);
  return { score: id + 1, level: value };
}

type PasswordStrengthMeterProps = {
  max?: number;
  value: number;
  /** Overrides the computed label (e.g. a specific tier name). */
  label?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export const PasswordStrengthMeter = React.forwardRef<
  HTMLDivElement,
  PasswordStrengthMeterProps
>(function PasswordStrengthMeter(props, ref) {
  const { max = 4, value, label, ...rest } = props;
  const percent = (value / max) * 100;
  const { colorClass, label: defaultLabel } = getColorPalette(percent);
  const accessibleLabel = label ?? defaultLabel;

  return (
    <div className="flex w-full flex-col gap-1" ref={ref} {...rest}>
      <meter
        aria-label={`Password strength: ${accessibleLabel}`}
        aria-valuetext={accessibleLabel}
        className="sr-only"
        low={max * 0.33}
        max={max}
        optimum={max}
        value={value}
      />
      <div aria-hidden="true" className="flex w-full gap-1">
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
      {label && <div className="text-xs">{accessibleLabel}</div>}
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
