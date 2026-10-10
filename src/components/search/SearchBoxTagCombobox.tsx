import { Portal, type ComboboxValueChangeDetails } from "@ark-ui/react";
import { useState } from "react";
import { Combobox } from "src/components/ui/overlay";
import { useTagCollection } from "src/lib/tags/tags.hooks";

type SearchBoxTagComboboxProps = {
  onValueChange: (details: ComboboxValueChangeDetails) => void;
  tags: readonly string[];
};

export const SearchBoxTagCombobox = ({
  onValueChange,
  tags,
}: SearchBoxTagComboboxProps) => {
  const [tagSearchValue, setTagSearchValue] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const { collection } = useTagCollection({
    search: tagSearchValue,
    exclude: tags,
  });

  const handleValueChange = (details: ComboboxValueChangeDetails) => {
    setTagSearchValue("");
    onValueChange(details);
  };

  return (
    <Combobox.Root
      closeOnSelect
      collection={collection}
      multiple
      onInputValueChange={(details) => {
        setTagSearchValue(details.inputValue);
      }}
      onOpenChange={(details) => setIsOpen(details.open)}
      onValueChange={handleValueChange}
      open={isOpen}
      openOnClick
      value={[...tags]}
    >
      <Combobox.Control>
        <Combobox.Input
          autoFocus
          id="tag-filter"
          placeholder="Select tags to filter…"
        />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>

      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.ItemGroup>
              {collection.items.length > 0 ? (
                collection.items.map((item: string) => (
                  <Combobox.Item item={item} key={item}>
                    {item}
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                ))
              ) : (
                <Combobox.Empty>No tags found</Combobox.Empty>
              )}
            </Combobox.ItemGroup>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};
