"use client";

import type {
  ButtonProps,
  GroupProps,
  InputProps,
  StackProps,
} from "@chakra-ui/react";
import {
  Box,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Stack,
  mergeRefs,
  useControllableState,
} from "@chakra-ui/react";
import * as React from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

export interface PasswordVisibilityProps {
  /**
   * The default visibility state of the password input.
   */
  defaultVisible?: boolean;
  /**
   * The controlled visibility state of the password input.
   */
  visible?: boolean;
  /**
   * Callback invoked when the visibility state changes.
   */
  onVisibleChange?: (visible: boolean) => void;
  /**
   * Custom icons for the visibility toggle button.
   */
  visibilityIcon?: { on: React.ReactNode; off: React.ReactNode };
}

export interface PasswordInputProps
  extends InputProps, PasswordVisibilityProps {
  rootProps?: GroupProps;
}

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
    ...rest
  } = props;

  const [visible, setVisible] = useControllableState({
    defaultValue: defaultVisible,
    onChange: onVisibleChange,
    value: visibleProp,
  });

  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <InputGroup
      endElement={
        <VisibilityTrigger
          disabled={rest.disabled}
          onPointerDown={(e) => {
            if (rest.disabled) return;
            if (e.button !== 0) return;
            e.preventDefault();
            setVisible(!visible);
          }}
        >
          {visible ? visibilityIcon.off : visibilityIcon.on}
        </VisibilityTrigger>
      }
      {...rootProps}
    >
      <Input
        {...rest}
        ref={mergeRefs(ref, inputRef)}
        type={visible ? "text" : "password"}
      />
    </InputGroup>
  );
});

const VisibilityTrigger = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function VisibilityTrigger(props, ref) {
    return (
      <IconButton
        aria-label="Toggle password visibility"
        aspectRatio="square"
        height="calc(100% - {spacing.2})"
        me="-2"
        ref={ref}
        size="sm"
        tabIndex={-1}
        variant="ghost"
        {...props}
      />
    );
  },
);

interface PasswordStrengthMeterProps extends StackProps {
  max?: number;
  value: number;
}

export const PasswordStrengthMeter = React.forwardRef<
  HTMLDivElement,
  PasswordStrengthMeterProps
>(function PasswordStrengthMeter(props, ref) {
  const { max = 4, value, ...rest } = props;

  const percent = (value / max) * 100;
  const { label, colorPalette } = getColorPalette(percent);

  return (
    <Stack align="flex-end" gap="1" ref={ref} {...rest}>
      <HStack width="full" {...rest}>
        {Array.from({ length: max }).map((_, index) => (
          <Box
            _selected={{
              colorPalette,
              layerStyle: "fill.solid",
            }}
            colorPalette="gray"
            data-selected={index < value ? "" : undefined}
            flex="1"
            height="1"
            key={index}
            layerStyle="fill.subtle"
            rounded="sm"
          />
        ))}
      </HStack>
      {label && <HStack textStyle="xs">{label}</HStack>}
    </Stack>
  );
});

function getColorPalette(percent: number) {
  switch (true) {
    case percent < 33:
      return { colorPalette: "red", label: "Low" };
    case percent < 66:
      return { colorPalette: "orange", label: "Medium" };
    default:
      return { colorPalette: "green", label: "High" };
  }
}
