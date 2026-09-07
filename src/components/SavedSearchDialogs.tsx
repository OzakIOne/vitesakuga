import { Portal } from "@ark-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { LuBookmark, LuBookmarkPlus, LuPlay, LuTrash2 } from "react-icons/lu";
import { Button, CloseButton } from "src/components/ui/button";
import { Field, Input } from "src/components/ui/field";
import { Box, HStack, VStack } from "src/components/ui/layout";
import { Dialog } from "src/components/ui/overlay";
import { Heading, Text } from "src/components/ui/typography";
import {
  useDeleteSavedSearch,
  useSaveSearch,
} from "src/lib/saved-searches/saved-searches.hooks";
import { savedSearchesQueryOptions } from "src/lib/saved-searches/saved-searches.queries";
import type {
  SavedSearch,
  SaveSearchInput,
} from "src/lib/saved-searches/saved-searches.schema";

type SearchValues = Omit<SaveSearchInput, "name">;

type SaveSearchDialogProps = {
  values: SearchValues;
};

export function SaveSearchDialog({ values }: SaveSearchDialogProps) {
  const { user } = useRouteContext({ from: "__root__" });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const saveMutation = useSaveSearch();

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/login">Log in to save</Link>
      </Button>
    );
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        setOpen(details.open);
        if (!details.open) {
          setName("");
          saveMutation.reset();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline">
          <LuBookmarkPlus aria-hidden="true" />
          Save search
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Save this search</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <form
                id="save-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmedName = name.trim();
                  if (!trimmedName) return;
                  saveMutation.mutate(
                    { ...values, name: trimmedName },
                    {
                      onSuccess: () => {
                        setOpen(false);
                        setName("");
                      },
                    },
                  );
                }}
              >
                <Field.Root>
                  <Field.Label htmlFor="saved-search-name">Name</Field.Label>
                  <Input
                    autoFocus
                    id="saved-search-name"
                    maxLength={100}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="My favorite action scenes"
                    value={name}
                  />
                  <Field.HelperText>
                    Your search filters and sorting will be saved too.
                  </Field.HelperText>
                </Field.Root>
              </form>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.CloseTrigger>
              <Button
                disabled={!name.trim()}
                form="save-search-form"
                loading={saveMutation.isPending}
                type="submit"
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

type SavedSearchesDialogProps = {
  onApply: (search: SavedSearch) => void;
};

export function SavedSearchesDialog({ onApply }: SavedSearchesDialogProps) {
  const { user } = useRouteContext({ from: "__root__" });
  const [open, setOpen] = useState(false);
  const savedSearchesQuery = useQuery({
    ...savedSearchesQueryOptions(),
    enabled: Boolean(user) && open,
  });
  const deleteMutation = useDeleteSavedSearch();

  if (!user) return null;

  const savedSearches = savedSearchesQuery.data ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline">
          <LuBookmark aria-hidden="true" />
          Saved searches
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className="max-h-[80vh] overflow-y-auto">
            <Dialog.Header>
              <Dialog.Title>Saved searches</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              {savedSearchesQuery.isPending ? (
                <Text>Loading saved searches...</Text>
              ) : savedSearches.length === 0 ? (
                <Text color="fg.muted">
                  You have no saved searches yet. Save the current search to
                  find it here.
                </Text>
              ) : (
                <VStack align="stretch" gap={2}>
                  {savedSearches.map((search) => (
                    <SavedSearchRow
                      isDeleting={
                        deleteMutation.isPending &&
                        deleteMutation.variables === search.id
                      }
                      key={search.id}
                      onApply={() => {
                        onApply(search);
                        setOpen(false);
                      }}
                      onDelete={() => deleteMutation.mutate(search.id)}
                      search={search}
                    />
                  ))}
                </VStack>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

type SavedSearchRowProps = {
  isDeleting: boolean;
  onApply: () => void;
  onDelete: () => void;
  search: SavedSearch;
};

function SavedSearchRow({
  isDeleting,
  onApply,
  onDelete,
  search,
}: SavedSearchRowProps) {
  return (
    <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={3}>
      <HStack align="start" justify="space-between" gap={3}>
        <VStack align="start" gap={1} minW={0}>
          <Heading as="h3" fontSize="sm">
            {search.name}
          </Heading>
          <Text color="fg.muted" fontSize="xs" lineClamp={2}>
            {search.q || "All posts"}
            {search.tags.length > 0 ? ` · ${search.tags.join(", ")}` : ""}
            {search.date_range !== "all" ? ` · ${search.date_range}` : ""}
          </Text>
        </VStack>
        <HStack flexShrink={0} gap={1}>
          <Button
            aria-label={`Apply ${search.name}`}
            onClick={onApply}
            size="xs"
          >
            <LuPlay aria-hidden="true" />
            Apply
          </Button>
          <Button
            aria-label={`Delete ${search.name}`}
            colorPalette="red"
            loading={isDeleting}
            onClick={onDelete}
            size="xs"
            variant="ghost"
          >
            <LuTrash2 aria-hidden="true" />
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}
