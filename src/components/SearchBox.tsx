import {
  ClientOnly,
  Portal,
  type ComboboxValueChangeDetails,
} from "@ark-ui/react";
import { useDebouncer } from "@tanstack/react-pacer/debouncer";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { LuX } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/feedback";
import { Field, Input } from "src/components/ui/field";
import { Box, Group, Wrap } from "src/components/ui/layout";
import { Combobox } from "src/components/ui/overlay";
import { Heading, Text } from "src/components/ui/typography";
import type { PostsSearchParams } from "src/lib/posts/posts.schema";
import { useTagCollection } from "src/lib/tags/tags.hooks";

import { SaveSearchDialog, SavedSearchesDialog } from "./SavedSearchDialogs";

// Tags are compared as a whole (order included) when deciding whether the
// applied filters moved; the separator cannot appear in a tag name.
const TAGS_KEY_SEPARATOR = "\u0000";

const tagsKey = (tags: readonly string[]): string =>
  tags.join(TAGS_KEY_SEPARATOR);

/**
 * The URL owns the applied filters; this hook manages the draft the user
 * edits. The draft is discarded whenever the applied value changes outside
 * the component (Back/Forward, direct URL edits, applying a saved search) so
 * the field, the URL and the results move together. `markDraftApplied`
 * optimistically records the values being navigated to, so the component's
 * own (debounced) navigation landing never snaps the field away while the
 * user keeps typing.
 */
function useSyncedDraft<T>(
  applied: T,
  appliedKey: string,
  draftKey: (draft: T) => string,
): [T, Dispatch<SetStateAction<T>>, (draft: T) => void] {
  const [draft, setDraft] = useState(applied);
  const [lastAppliedKey, setLastAppliedKey] = useState(appliedKey);
  const [draftSyncedKey, setDraftSyncedKey] = useState(appliedKey);

  if (appliedKey !== lastAppliedKey) {
    setLastAppliedKey(appliedKey);
    // A landing of this component's own navigation matches the key the draft
    // already mirrors; anything else changed outside and wins over the draft.
    if (appliedKey !== draftSyncedKey) {
      setDraftSyncedKey(appliedKey);
      setDraft(applied);
    }
  }

  const markDraftApplied = (value: T) => {
    setDraftSyncedKey(draftKey(value));
  };

  return [draft, setDraft, markDraftApplied];
}

type SearchBoxProps = {
  /** Active search query from the URL; the URL owns the applied filters. */
  appliedQuery?: string | undefined;
  /** Active tag filters from the URL. */
  appliedTags?: readonly string[] | undefined;
  placeholder?: string | undefined;
  showTitle?: boolean | undefined;
  dateRange?: PostsSearchParams["dateRange"] | undefined;
  sortBy?: PostsSearchParams["sortBy"] | undefined;
  title?: string | undefined;
};

export function SearchBox({
  appliedQuery = "",
  appliedTags = [],
  placeholder = "Search...",
  showTitle = true,
  dateRange = "all",
  sortBy = "newest",
  title = "Search Posts",
}: SearchBoxProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The field and the tag combobox edit *drafts*; the applied filters live in
  // the URL and drive the results (see useSyncedDraft).
  const [draftQuery, setDraftQuery, markQueryDraftApplied] = useSyncedDraft(
    appliedQuery,
    appliedQuery,
    (draft) => draft,
  );
  const [draftTags, setDraftTags, markTagsDraftApplied] = useSyncedDraft(
    appliedTags,
    tagsKey(appliedTags),
    tagsKey,
  );

  const handleTagChange = (details: ComboboxValueChangeDetails) => {
    setDraftTags([...details.value]);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setDraftTags(draftTags.filter((tag) => tag !== tagToRemove));
  };

  const applyDraftToUrl = () => {
    markQueryDraftApplied(draftQuery);
    markTagsDraftApplied(draftTags);
    void navigate({
      search: {
        dateRange,
        q: draftQuery,
        sortBy,
        tags: draftTags,
      },
      to: pathname === "/" ? "/posts" : pathname,
    });
  };

  const setDebouncedQuery = useDebouncer(applyDraftToUrl, {
    enabled: () => draftQuery.length > 2,
    wait: 500,
  });

  return (
    <Box w="auto">
      {showTitle && (
        <Heading mb={3} size="sm">
          {title}
        </Heading>
      )}
      <Group attached mb={4} w="full">
        <Input
          aria-label="Search posts"
          id="search-input"
          name="q"
          onChange={(e) => {
            const newValue = e.target.value;
            setDraftQuery(newValue);
            setDebouncedQuery.maybeExecute();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setDebouncedQuery.flush();
              applyDraftToUrl();
            }
          }}
          placeholder={placeholder}
          size="sm"
          type="search"
          value={draftQuery}
        />
        <Button
          onClick={() => {
            setDebouncedQuery.flush();
            applyDraftToUrl();
          }}
          size="sm"
        >
          Search
        </Button>
      </Group>
      <Wrap gap={2} mb={4}>
        <SaveSearchDialog
          values={{ dateRange, q: draftQuery, sortBy, tags: draftTags }}
        />
        <SavedSearchesDialog
          onApply={(savedSearch) => {
            setDraftQuery(savedSearch.q);
            setDraftTags([...savedSearch.tags]);
            void navigate({
              search: {
                dateRange: savedSearch.date_range,
                q: savedSearch.q,
                sortBy: savedSearch.sort_by,
                tags: savedSearch.tags,
              },
              to: "/posts",
            });
          }}
        />
      </Wrap>
      <Text color="fg.muted" fontSize="xs" mb={3}>
        Advanced filters: <code>width:&gt;1000</code>, <code>height:=800</code>,{" "}
        <code>height:&lt;800</code>, <code>likes:&gt;10</code>,{" "}
        <code>video_width:=1920</code>, <code>-movies</code>
      </Text>
      <Field.Root>
        <Field.Label fontSize="sm">Filter by Tags</Field.Label>
        <Box w="full">
          <ClientOnly fallback={null}>
            <SearchBoxTagCombobox
              onValueChange={handleTagChange}
              tags={draftTags}
            />
          </ClientOnly>
          {draftTags.length > 0 && (
            <Wrap gap="2" mt={2}>
              {draftTags.map((tag) => (
                <Badge
                  alignItems="center"
                  display="flex"
                  gap={1}
                  key={tag}
                  px={2}
                  py={1}
                >
                  {tag}
                  <button
                    aria-label={`Remove tag ${tag}`}
                    className="cursor-pointer rounded transition-colors hover:text-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:outline-none"
                    onClick={() => {
                      handleRemoveTag(tag);
                    }}
                    type="button"
                  >
                    <LuX aria-hidden="true" />
                  </button>
                </Badge>
              ))}
            </Wrap>
          )}
        </Box>
      </Field.Root>
    </Box>
  );
}

type SearchBoxTagComboboxProps = {
  onValueChange: (details: ComboboxValueChangeDetails) => void;
  tags: readonly string[];
};

function SearchBoxTagCombobox({
  onValueChange,
  tags,
}: SearchBoxTagComboboxProps) {
  const [tagSearchValue, setTagSearchValue] = useState("");

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
      onValueChange={handleValueChange}
      openOnClick
      value={[...tags]}
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
  );
}
