import { useCombobox } from "@chakra-ui/react";
import { Box, Input, VStack, Text } from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchTags } from "../../utils/tags";

type Tag = {
  id?: number;
  name: string;
};

interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["tags", inputValue],
    queryFn: () => searchTags({ data: { query: inputValue } }),
    enabled: inputValue.length > 0,
  });

  const handleSelect = useCallback(
    (selectedTag: Tag) => {
      if (!value.some((tag) => tag.name === selectedTag.name)) {
        onChange([...value, selectedTag]);
      }
      setInputValue("");
      setIsOpen(false);
    },
    [value, onChange]
  );

  const handleRemoveTag = useCallback(
    (tagToRemove: Tag) => {
      onChange(value.filter((tag) => tag.name !== tagToRemove.name));
    },
    [value, onChange]
  );

  const handleCreateTag = useCallback(() => {
    if (
      inputValue.trim() &&
      !value.some((tag) => tag.name === inputValue.trim())
    ) {
      onChange([...value, { name: inputValue.trim() }]);
      setInputValue("");
      setIsOpen(false);
    }
  }, [inputValue, value, onChange]);

  return (
    <Box position="relative" width="full">
      <Box display="flex" flexDirection="column" gap={2}>
        <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
          {value.map((tag) => (
            <Box
              key={tag.name}
              px={2}
              py={1}
              borderRadius="md"
              display="flex"
              alignItems="center"
            >
              <Text>{tag.name}</Text>
              <Box
                ml={2}
                cursor="pointer"
                onClick={() => handleRemoveTag(tag)}
                _hover={{ color: "red.500" }}
              >
                ×
              </Box>
            </Box>
          ))}
        </Box>
        <Box position="relative" width="full">
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            placeholder="Add tags..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateTag();
              }
            }}
          />
          {isOpen && inputValue && (
            <Box
              position="absolute"
              top="100%"
              left={0}
              right={0}
              shadow="md"
              borderRadius="md"
              maxH="200px"
              overflowY="auto"
              zIndex={1}
            >
              {suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <Box
                    key={suggestion.id}
                    p={2}
                    cursor="pointer"
                    onClick={() => handleSelect(suggestion)}
                  >
                    {suggestion.name}
                  </Box>
                ))
              ) : (
                <Box p={2} cursor="pointer" onClick={handleCreateTag}>
                  Create tag: {inputValue}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
