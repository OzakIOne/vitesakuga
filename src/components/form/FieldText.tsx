import {
  Field,
  Input,
  type InputProps,
  Textarea,
  type TextareaProps,
} from "@chakra-ui/react";
import type { AnyFieldApi } from "@tanstack/react-form";
import { FieldInfo } from "./FieldInfo";

interface FormTextareaFieldProps {
  field: AnyFieldApi;
  label?: string;
  isRequired?: boolean;
  helper?: string;
  asTextarea?: boolean;
  inputProps?: InputProps & TextareaProps;
}

export function FormTextWrapper({
  field,
  label,
  isRequired,
  helper,
  asTextarea,
  inputProps,
}: FormTextareaFieldProps) {
  return (
    <>
      <Field.Root required={isRequired}>
        <Field.Label>
          {label} <Field.RequiredIndicator />
        </Field.Label>
        {asTextarea ? (
          <Textarea
            id={field.name}
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            {...inputProps}
          />
        ) : (
          <Input
            id={field.name}
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            {...inputProps}
          />
        )}
        {helper && <Field.HelperText>{helper}</Field.HelperText>}
      </Field.Root>
      <FieldInfo field={field} />
    </>
  );
}
