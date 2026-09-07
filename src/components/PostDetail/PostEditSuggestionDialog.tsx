import { Portal } from "@ark-ui/react";
import { Schema } from "effect";
import { useState } from "react";
import { Button } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Field, Input, Textarea } from "src/components/ui/field";
import { HStack, Stack } from "src/components/ui/layout";
import { Dialog } from "src/components/ui/overlay";
import { Text } from "src/components/ui/typography";
import { useProposeEdit } from "src/lib/post-edits/post-edits.hooks";
import {
  postEditPayloadSchema,
  type PostEditPayload,
} from "src/lib/post-edits/post-edits.schema";
import type { fetchPostDetail } from "src/lib/posts/posts.service";

type Post = Awaited<ReturnType<typeof fetchPostDetail>>["post"];

const FIELD_LABELS = {
  animeTitle: "Anime title",
  chapterNumber: "Chapter",
  description: "Description",
  episodeNumber: "Episode",
  seasonNumber: "Season",
  source: "Source URL",
  title: "Title",
  volumeNumber: "Volume",
} as const satisfies Record<keyof PostEditPayload, string>;

type FieldKey = keyof typeof FIELD_LABELS;
type Draft = Record<FieldKey, string>;

export const FIELD_KEYS = [
  "animeTitle",
  "chapterNumber",
  "description",
  "episodeNumber",
  "seasonNumber",
  "source",
  "title",
  "volumeNumber",
] as const satisfies ReadonlyArray<FieldKey>;

const toDraft = (post: Post) =>
  ({
    animeTitle: post.animeTitle ?? "",
    chapterNumber: post.chapterNumber?.toString() ?? "",
    description: post.description,
    episodeNumber: post.episodeNumber?.toString() ?? "",
    seasonNumber: post.seasonNumber?.toString() ?? "",
    source: post.source ?? "",
    title: post.title,
    volumeNumber: post.volumeNumber?.toString() ?? "",
  }) satisfies Draft;

const displayValue = (value: string): string => value.trim() || "Empty";

type PostEditSuggestionDialogProps = {
  onCancel: () => void;
  post: Post;
};

export function PostEditSuggestionDialog({
  onCancel,
  post,
}: PostEditSuggestionDialogProps) {
  const [draft, setDraft] = useState(() => toDraft(post));
  const [error, setError] = useState<string | null>(null);
  const submitSuggestion = useProposeEdit(post.id);
  const original = toDraft(post);
  const changedFields = FIELD_KEYS.filter(
    (key) => draft[key] !== original[key],
  );

  const setField = (key: FieldKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const buildPayload = (): PostEditPayload | null => {
    const payload: Partial<Record<FieldKey, string | number | null>> = {};
    for (const key of changedFields) {
      const value = draft[key].trim();
      if (key === "title" || key === "description") {
        if (value.length < 3) {
          setError(`${FIELD_LABELS[key]} must be at least 3 characters.`);
          return null;
        }
        payload[key] = value;
        continue;
      }
      if (key === "source") {
        if (value && !/^https?:\/\//.test(value)) {
          setError("Source URL must start with http:// or https://.");
          return null;
        }
        payload[key] = value || null;
        continue;
      }
      if (key.endsWith("Number")) {
        if (!value) {
          payload[key] = null;
          continue;
        }
        const number = Number(value);
        if (!Number.isFinite(number)) {
          setError(`${FIELD_LABELS[key]} must be a number.`);
          return null;
        }
        payload[key] = number;
        continue;
      }
      payload[key] = value || null;
    }
    return changedFields.length > 0
      ? Schema.decodeUnknownSync(postEditPayloadSchema)(payload)
      : null;
  };

  const handleSubmit = () => {
    const payload = buildPayload();
    if (!payload) {
      setError((current) => current ?? "Make at least one change first.");
      return;
    }
    submitSuggestion.mutate(payload, { onSuccess: onCancel });
  };

  return (
    <Dialog.Root
      defaultOpen
      onEscapeKeyDown={onCancel}
      onInteractOutside={onCancel}
      onOpenChange={(details) => {
        if (!details.open) onCancel();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className="max-h-[90vh] overflow-y-auto" maxW="xl">
            <Dialog.Header>
              <Dialog.Title>Suggest an edit</Dialog.Title>
              <Dialog.CloseTrigger onClick={onCancel} />
            </Dialog.Header>
            <Dialog.Body>
              <Stack align="stretch" gap={4}>
                <Text color="gray.500" fontSize="sm">
                  Improve this post&apos;s metadata. Your suggestion will be
                  reviewed by uploaders, the post owner, or staff.
                </Text>

                <Stack align="stretch" gap={3}>
                  <Field.Root>
                    <Field.Label htmlFor="suggest-edit-title">
                      Title
                    </Field.Label>
                    <Input
                      id="suggest-edit-title"
                      onChange={(event) =>
                        setField("title", event.target.value)
                      }
                      value={draft.title}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label htmlFor="suggest-edit-description">
                      Description
                    </Field.Label>
                    <Textarea
                      id="suggest-edit-description"
                      onChange={(event) =>
                        setField("description", event.target.value)
                      }
                      value={draft.description}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label htmlFor="suggest-edit-source">
                      Source URL
                    </Field.Label>
                    <Input
                      id="suggest-edit-source"
                      onChange={(event) =>
                        setField("source", event.target.value)
                      }
                      placeholder="https://..."
                      value={draft.source}
                    />
                  </Field.Root>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["animeTitle", "Anime title", "text"],
                        ["seasonNumber", "Season", "number"],
                        ["episodeNumber", "Episode", "number"],
                        ["chapterNumber", "Chapter", "number"],
                        ["volumeNumber", "Volume", "number"],
                      ] as const
                    ).map(([key, label, type]) => (
                      <Field.Root key={key}>
                        <Field.Label htmlFor={`suggest-edit-${key}`}>
                          {label}
                        </Field.Label>
                        <Input
                          id={`suggest-edit-${key}`}
                          onChange={(event) =>
                            setField(key, event.target.value)
                          }
                          type={type}
                          value={draft[key]}
                        />
                      </Field.Root>
                    ))}
                  </div>
                </Stack>

                <Stack align="stretch" gap={2}>
                  <Text fontWeight="bold">Review changes</Text>
                  {changedFields.length === 0 ? (
                    <Text color="gray.500" fontSize="sm">
                      No changes yet.
                    </Text>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-gray-200 text-sm dark:border-gray-700">
                      <div className="grid grid-cols-[minmax(7rem,0.7fr)_1fr_1fr] gap-2 bg-gray-50 px-3 py-2 font-medium dark:bg-gray-800">
                        <span>Field</span>
                        <span>Current</span>
                        <span>Suggested</span>
                      </div>
                      {changedFields.map((key) => (
                        <div
                          className="grid grid-cols-[minmax(7rem,0.7fr)_1fr_1fr] gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700"
                          key={key}
                        >
                          <span className="font-medium">
                            {FIELD_LABELS[key]}
                          </span>
                          <span className="break-words text-red-700 dark:text-red-300">
                            {displayValue(original[key])}
                          </span>
                          <span className="break-words text-green-700 dark:text-green-300">
                            {displayValue(draft[key])}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Stack>
                {error && <Alert.Root status="error">{error}</Alert.Root>}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2}>
                <Button
                  disabled={submitSuggestion.isPending}
                  loading={submitSuggestion.isPending}
                  onClick={handleSubmit}
                >
                  Submit suggestion
                </Button>
                <Button
                  disabled={submitSuggestion.isPending}
                  onClick={onCancel}
                  variant="ghost"
                >
                  Cancel
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export { FIELD_LABELS };
