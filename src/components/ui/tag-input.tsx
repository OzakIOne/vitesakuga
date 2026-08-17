import {
  ClientOnly,
  Portal,
  createListCollection,
  type ComboboxInputValueChangeDetails,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import { useMemo, useState } from "react";
import { LuX } from "react-icons/lu";
import type { Tag } from "src/lib/posts/posts.schema";
import { useTagCollection } from "src/lib/tags/tags.hooks";

import { Badge } from "./feedback";
import { Box, Wrap } from "./layout";
import { Combobox } from "./overlay";

type TagInputProps = {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  onBlur?: () => void;
};

export function TagInput({ value, onChange, onBlur }: TagInputProps) {
  return (
    <Box w="full">
      <ClientOnly fallback={null}>
        <TagInputCombobox
          onChange={onChange}
          value={value}
          {...(onBlur ? { onBlur } : {})}
        />
      </ClientOnly>
    </Box>
  );
}

function TagInputCombobox({
  value,
  onChange,
  onBlur,
}: TagInputProps) {
  const [searchValue, setSearchValue] = useState("");

  const { allTags, collection: baseCollection } = useTagCollection({
    search: searchValue,
    exclude: value.map((tag) => tag.name),
  });

  const showCreateOption = useMemo(() => {
    if (!searchValue.trim()) {
      return false;
    }
    const exactMatch = allTags.some(
      (tag: { name: string }) =>
        tag.name.toLowerCase() === searchValue.toLowerCase(),
    );
    return !exactMatch;
  }, [searchValue, allTags]);

  const items = useMemo(() => {
    if (showCreateOption) {
      return [...baseCollection.items, `Create: ${searchValue}`];
    }
    return baseCollection.items;
  }, [baseCollection.items, showCreateOption, searchValue]);

  const collection = useMemo(() => createListCollection({ items }), [items]);

  const handleValueChange = (details: ComboboxValueChangeDetails) => {
    const newValues = details.value;
    const addedValue = newValues.at(-1);

    if (!addedValue) {
      return;
    }

    if (addedValue.startsWith("Create: ")) {
      const newTagName = addedValue.replace("Create: ", "").trim();
      onChange([...value, { name: newTagName }]);
    } else {
      const selectedTag = allTags.find(
        (tag: { name: string }) => tag.name === addedValue,
      );
      if (selectedTag && !value.some((tag) => tag.name === selectedTag.name)) {
        onChange([...value, selectedTag]);
      }
    }

    setSearchValue("");
  };

  const handleRemoveTag = (tagToRemove: Tag) => {
    onChange(value.filter((tag) => tag.name !== tagToRemove.name));
  };

  return (
    <Combobox.Root
      closeOnSelect
      collection={collection}
      multiple
      onInputValueChange={(details: ComboboxInputValueChangeDetails) => {
        setSearchValue(details.inputValue);
      }}
      onValueChange={handleValueChange}
      value={value.map((tag) => tag.name)}
    >
      {value.length > 0 && (
        <Wrap className="mb-2">
          {value.map((tag) => (
            <Badge
              alignItems="center"
              display="flex"
              gap={1}
              key={tag.name}
              px={2}
              py={1}
            >
              {tag.name}
              <LuX
                className="cursor-pointer transition-colors hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
              />
            </Badge>
          ))}
        </Wrap>
      )}

      <Combobox.Control>
        <Combobox.Input onBlur={onBlur} placeholder="Add tags..." />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>

      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.ItemGroup>
              {items.length > 0 ? (
                items.map((item: string) => (
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
}
