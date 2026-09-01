import {
  Portal,
  createListCollection,
  type ComboboxInputValueChangeDetails,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import { useMemo } from "react";
import { Combobox } from "src/components/ui/overlay";

const EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
] as const;

type EmailAutocompleteProps = {
  id?: string | undefined;
  name?: string | undefined;
  onBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  value: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "name" | "onBlur" | "onChange" | "placeholder" | "value"
>;

/**
 * Combobox that dynamically suggests full email addresses from a list of
 * common domains as the user types (Ark UI "dynamic" pattern).
 */
export function EmailAutocomplete({
  id,
  name,
  onBlur,
  onChange,
  placeholder = "hello@example.com",
  value,
  ...inputProps
}: EmailAutocompleteProps) {
  const collection = useMemo(() => {
    const atIndex = value.indexOf("@");
    const localPart = (atIndex === -1 ? value : value.slice(0, atIndex)).trim();
    const typedDomain = atIndex === -1 ? "" : value.slice(atIndex + 1);

    if (!localPart) {
      return createListCollection<string>({ items: [] });
    }

    const items = EMAIL_DOMAINS.filter((domain) =>
      domain.startsWith(typedDomain.toLowerCase()),
    ).map((domain) => `${localPart}@${domain}`);
    return createListCollection({ items });
  }, [value]);

  const handleInputValueChange = (details: ComboboxInputValueChangeDetails) => {
    // Ignore programmatic input updates (e.g. the machine syncing the
    // controlled `inputValue` prop after a selection) — they carry a stale
    // value and would overwrite the field right after a suggestion is picked.
    // Selections are handled in `handleValueChange`.
    if (details.reason === "input-change") {
      onChange(details.inputValue);
    } else if (details.reason === "clear-trigger") {
      onChange("");
    }
  };

  const handleValueChange = (details: ComboboxValueChangeDetails) => {
    const selected = details.value[0];
    if (selected) {
      onChange(selected);
    }
  };

  return (
    <Combobox.Root
      collection={collection}
      inputValue={value}
      onInputValueChange={handleInputValueChange}
      onValueChange={handleValueChange}
      selectionBehavior="replace"
    >
      <Combobox.Control>
        <Combobox.Input
          autoComplete="email"
          id={id}
          name={name}
          onBlur={onBlur}
          placeholder={placeholder}
          spellCheck={false}
          {...inputProps}
        />
        <Combobox.IndicatorGroup>
          {value.length > 0 && <Combobox.ClearTrigger />}
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>

      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.ItemGroup>
              {collection.items.length > 0 ? (
                collection.items.map((item) => (
                  <Combobox.Item item={item} key={item}>
                    <Combobox.ItemText>{item}</Combobox.ItemText>
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                ))
              ) : (
                <Combobox.Empty>No email suggestions</Combobox.Empty>
              )}
            </Combobox.ItemGroup>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
}
