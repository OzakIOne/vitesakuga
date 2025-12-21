import { Badge, Box, Combobox, Icon, Portal, Wrap, createListCollection } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuX } from "react-icons/lu";
import { tagsQueryGetTags } from "src/lib/tags/tags.queries";

type Tag = {
  id?: number;
  name: string;
};

interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [searchValue, setSearchValue] = useState("");

  const { data: allTags = [] } = useQuery(tagsQueryGetTags());

  // Filter tags based on search and exclude already selected tags
  const filteredTags = useMemo(() => {
    const selectedNames = value.map((tag) => tag.name);
    return allTags
      .filter((tag) => !selectedNames.includes(tag.name))
      .filter((tag) => tag.name.toLowerCase().includes(searchValue.toLowerCase()));
  }, [allTags, searchValue, value]);

  // Check if we should show "Create new tag" option
  const showCreateOption = useMemo(() => {
    if (!searchValue.trim()) return false;
    const exactMatch = allTags.some((tag) => tag.name.toLowerCase() === searchValue.toLowerCase());
    return !exactMatch;
  }, [searchValue, allTags]);

  // Combine filtered tags with create option
  const items = useMemo(() => {
    const tagNames = filteredTags.map((tag) => tag.name);
    if (showCreateOption) {
      return [...tagNames, `Create: ${searchValue}`];
    }
    return tagNames;
  }, [filteredTags, showCreateOption, searchValue]);

  const collection = useMemo(() => createListCollection({ items }), [items]);

  const handleValueChange = (details: Combobox.ValueChangeDetails) => {
    const newValues = details.value;
    const addedValue = newValues[newValues.length - 1];

    if (!addedValue) return;

    // Check if it's a create action
    if (addedValue.startsWith("Create: ")) {
      const newTagName = addedValue.replace("Create: ", "").trim();
      onChange([...value, { name: newTagName }]);
    } else {
      // Find the tag from allTags
      const selectedTag = allTags.find((tag) => tag.name === addedValue);
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
    <Box>
      <Combobox.Root
        closeOnSelect
        collection={collection}
        multiple
        onInputValueChange={(details) => setSearchValue(details.inputValue)}
        onValueChange={handleValueChange}
        value={value.map((tag) => tag.name)}
        width="full"
      >
        {value.length > 0 && (
          <Wrap gap="2" mb={2}>
            {value.map((tag) => (
              <Badge alignItems="center" display="flex" gap={1} key={tag.name} px={2} py={1}>
                {tag.name}
                <Icon
                  _hover={{ color: "red.500" }}
                  cursor="pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                  }}
                >
                  <LuX />
                </Icon>
              </Badge>
            ))}
          </Wrap>
        )}

        <Combobox.Control>
          <Combobox.Input placeholder="Add tags..." />
          <Combobox.IndicatorGroup>
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>

        <Portal>
          <Combobox.Positioner>
            <Combobox.Content>
              <Combobox.ItemGroup>
                {items.length > 0 ? (
                  items.map((item) => (
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
    </Box>
  );
}
