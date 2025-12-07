import { Box, Heading, Input } from "@chakra-ui/react";
import { useDebouncer } from "@tanstack/react-pacer/debouncer";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

interface SearchBoxProps {
  defaultValue?: string;
  placeholder?: string;
  showTitle?: boolean;
  title?: string;
}

export function SearchBox({
  defaultValue = "",
  placeholder = "Search...",
  showTitle = true,
  title = "Search Posts",
}: SearchBoxProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState(defaultValue);

  const handleSearch = (searchValue: string) => {
    const trimmed = searchValue.trim();
    if (trimmed) {
      navigate({ to: "/posts", search: { q: trimmed } });
    } else {
      navigate({ to: "/posts" });
    }
  };

  const setDebouncedQuery = useDebouncer(
    (searchValue: string) => {
      const trimmed = searchValue.trim();
      if (trimmed) {
        navigate({ to: "/posts", search: { q: trimmed } });
      }
    },
    {
      wait: 500,
      enabled: () => value.length > 2,
    },
  );

  return (
    <Box>
      {showTitle && (
        <Heading size="sm" mb={3}>
          {title}
        </Heading>
      )}
      <Input
        placeholder={placeholder}
        size="sm"
        value={value}
        onChange={(e) => {
          const newValue = e.target.value;
          setValue(newValue);
          setDebouncedQuery.maybeExecute(newValue);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setDebouncedQuery.flush();
            handleSearch(value);
          }
        }}
      />
      {defaultValue && (
        <Box fontSize="xs" mt={2}>
          Searching for: <strong>{defaultValue}</strong>
        </Box>
      )}
    </Box>
  );
}
