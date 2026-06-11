import {
  Badge,
  Box,
  Button,
  Combobox,
  Field,
  Group,
  Heading,
  Icon,
  Input,
  Portal,
  Wrap,
} from "@chakra-ui/react";
import { useDebouncer } from "@tanstack/react-pacer/debouncer";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LuX } from "react-icons/lu";
import { useTagCollection } from "src/lib/tags/tags.hooks";

type SearchBoxProps = {
  defaultValue?: string | undefined;
  defaultTags?: string[] | undefined;
  placeholder?: string | undefined;
  showTitle?: boolean | undefined;
  title?: string | undefined;
};

export function SearchBox({
  defaultValue = "",
  defaultTags = [],
  placeholder = "Search...",
  showTitle = true,
  title = "Search Posts",
}: SearchBoxProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState(defaultValue);
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [tagSearchValue, setTagSearchValue] = useState("");

  const { collection } = useTagCollection({
    search: tagSearchValue,
    exclude: tags,
  });

  const handleAddTag = (details: Combobox.ValueChangeDetails) => {
    const newValues = details.value;
    const addedValue = newValues.at(-1);

    if (addedValue && !tags.includes(addedValue)) {
      const newTags = [...tags, addedValue];
      setTags(newTags);
    }

    setTagSearchValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
  };

  const handleNavigate = () => {
    void navigate({
      search: {
        q: search,
        tags,
      },
      to: pathname === "/" ? "/posts" : pathname,
    });
  };

  const setDebouncedQuery = useDebouncer(
    () => {
      handleNavigate();
    },
    {
      enabled: () => search.length > 2,
      wait: 500,
    },
  );

  return (
    <Box w="auto">
      {showTitle && (
        <Heading mb={3} size="sm">
          {title}
        </Heading>
      )}
      <Group attached mb={4} w="full">
        <Input
          id="search-input"
          onChange={(e) => {
            const newValue = e.target.value;
            setSearch(newValue);
            setDebouncedQuery.maybeExecute();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setDebouncedQuery.flush();
              handleNavigate();
            }
          }}
          placeholder={placeholder}
          size="sm"
          value={search}
        />
        <Button
          onClick={() => {
            setDebouncedQuery.flush();
            handleNavigate();
          }}
          size="sm"
        >
          Search
        </Button>
      </Group>
      <Field.Root>
        <Field.Label fontSize="sm">Filter by Tags</Field.Label>
        <Box w="full">
          {tags.length > 0 && (
            <Wrap gap="2" mb={2}>
              {tags.map((tag) => (
                <Badge
                  alignItems="center"
                  display="flex"
                  gap={1}
                  key={tag}
                  px={2}
                  py={1}
                >
                  {tag}
                  <Icon
                    _hover={{ color: "red.500" }}
                    cursor="pointer"
                    onClick={() => {
                      handleRemoveTag(tag);
                    }}
                  >
                    <LuX />
                  </Icon>
                </Badge>
              ))}
            </Wrap>
          )}
          <Combobox.Root
            closeOnSelect
            collection={collection}
            multiple
            onInputValueChange={(details) => {
              setTagSearchValue(details.inputValue);
            }}
            onValueChange={handleAddTag}
            value={tags}
          >
            <Combobox.Control>
              <Combobox.Input placeholder="Select tags to filter..." />
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
        </Box>
      </Field.Root>
    </Box>
  );
}
