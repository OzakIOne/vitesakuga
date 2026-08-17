import {
  ClientOnly,
  Portal,
  createListCollection,
  useCombobox,
  useTagsInput,
  type ComboboxInputValueChangeDetails,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import { useId, useMemo, useState } from "react";
import type { Tag } from "src/lib/posts/posts.schema";
import { useTagCollection } from "src/lib/tags/tags.hooks";

import { Box } from "./layout";
import { Combobox, TagsInput } from "./overlay";

/**
 * Sentinel item used to offer "create a new tag" in the combobox popup when
 * the typed value does not match any existing tag (official creatable pattern).
 */
const CREATE_TAG_VALUE = "\u0000create-tag";

type TagInputProps = {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  onBlur?: () => void;
};

export function TagInput({ value, onChange, onBlur }: TagInputProps) {
  return (
    <ClientOnly fallback={null}>
      <TagInputCombobox
        onChange={onChange}
        value={value}
        {...(onBlur ? { onBlur } : {})}
      />
    </ClientOnly>
  );
}

function TagInputCombobox({ value, onChange, onBlur }: TagInputProps) {
  const uid = useId();
  const [searchValue, setSearchValue] = useState("");

  const tagNames = useMemo(() => value.map((tag) => tag.name), [value]);

  const { allTags, collection: baseCollection } = useTagCollection({
    search: searchValue,
    exclude: tagNames,
  });

  const showCreateOption = useMemo(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      return false;
    }
    return !allTags.some(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
    );
  }, [allTags, searchValue]);

  const collection = useMemo(() => {
    const items = showCreateOption
      ? [...baseCollection.items, CREATE_TAG_VALUE]
      : baseCollection.items;
    return createListCollection({ items });
  }, [baseCollection.items, showCreateOption]);

  const tagsInput = useTagsInput({
    allowDuplicates: false,
    blurBehavior: "clear",
    ids: { control: `control-${uid}`, input: `input-${uid}` },
    onValueChange: (details) => {
      onChange(details.value.map((name) => ({ name })));
    },
    value: tagNames,
  });

  const combobox = useCombobox({
    allowCustomValue: true,
    closeOnSelect: true,
    collection,
    ids: { control: `control-${uid}`, input: `input-${uid}` },
    onInputValueChange: (details: ComboboxInputValueChangeDetails) => {
      setSearchValue(details.inputValue);
    },
    onValueChange: (details: ComboboxValueChangeDetails) => {
      const selectedValue = details.value[0];
      if (!selectedValue) {
        return;
      }
      const newTagName =
        selectedValue === CREATE_TAG_VALUE ? searchValue.trim() : selectedValue;
      if (newTagName) {
        tagsInput.addValue(newTagName);
      }
      setSearchValue("");
    },
    openOnClick: true,
    selectionBehavior: "clear",
    value: [],
  });

  return (
    <Combobox.RootProvider value={combobox}>
      <TagsInput.RootProvider value={tagsInput}>
        <TagsInput.Control>
          <Combobox.Input asChild>
            <TagsInput.Input onBlur={onBlur} placeholder="Add tags..." />
          </Combobox.Input>
        </TagsInput.Control>
        {tagNames.length > 0 && (
          <Box display="flex" flexWrap="wrap" gap={1.5} mt={2}>
            {tagNames.map((tagName, index) => (
              <TagsInput.Item index={index} key={tagName} value={tagName}>
                <TagsInput.ItemPreview>
                  <TagsInput.ItemText>{tagName}</TagsInput.ItemText>
                  <TagsInput.ItemDeleteTrigger />
                </TagsInput.ItemPreview>
                <TagsInput.ItemInput />
              </TagsInput.Item>
            ))}
            <TagsInput.ClearTrigger />
          </Box>
        )}
      </TagsInput.RootProvider>

      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.ItemGroup>
              {collection.items.length > 0 ? (
                collection.items.map((item) => (
                  <Combobox.Item item={item} key={item}>
                    <Combobox.ItemText>
                      {item === CREATE_TAG_VALUE
                        ? `Create "${searchValue.trim()}"`
                        : item}
                    </Combobox.ItemText>
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
    </Combobox.RootProvider>
  );
}
