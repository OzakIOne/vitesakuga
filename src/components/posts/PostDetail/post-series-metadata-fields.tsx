import { trim } from "effect/String";
import { Field, Input } from "src/components/ui/field";
import { NumberInput } from "src/components/ui/number-input";
import type { SeriesSourceType } from "src/lib/posts/posts.schema";

export type SeriesDraft = {
  animeTitle: string;
  chapterNumber: string;
  episodeNumber: string;
  seasonNumber: string;
  sourceType: string;
  volumeNumber: string;
};

type SeriesMetadataSource = {
  animeTitle: string | null;
  chapterNumber: number | null;
  episodeNumber: number | null;
  seasonNumber: number | null;
  sourceType: SeriesSourceType | null;
  volumeNumber: number | null;
};

const toDraftNumber = (value: number | null): string => value?.toString() ?? "";

export const toSeriesDraft = (post: SeriesMetadataSource): SeriesDraft => ({
  animeTitle: post.animeTitle ?? "",
  chapterNumber: toDraftNumber(post.chapterNumber),
  episodeNumber: toDraftNumber(post.episodeNumber),
  seasonNumber: toDraftNumber(post.seasonNumber),
  sourceType: post.sourceType ?? "",
  volumeNumber: toDraftNumber(post.volumeNumber),
});

const toNumberOrNull = (value: string): number | null => {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toSourceType = (value: string): SeriesSourceType | null =>
  value === "movie" || value === "tv_series" ? value : null;

export const toSeriesPayload = (draft: SeriesDraft) => ({
  animeTitle: trim(draft.animeTitle) || null,
  chapterNumber: toNumberOrNull(draft.chapterNumber),
  episodeNumber: toNumberOrNull(draft.episodeNumber),
  seasonNumber: toNumberOrNull(draft.seasonNumber),
  sourceType: toSourceType(draft.sourceType),
  volumeNumber: toNumberOrNull(draft.volumeNumber),
});

type SeriesNumberFieldProps = {
  disabled: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

const SeriesNumberField = ({
  disabled,
  id,
  label,
  onChange,
  value,
}: SeriesNumberFieldProps) => (
  <Field.Root>
    <Field.Label htmlFor={id}>{label}</Field.Label>
    <NumberInput.Root
      disabled={disabled}
      onValueChange={(details) => {
        onChange(details.value);
      }}
      value={value}
    >
      <NumberInput.Control>
        <NumberInput.Input id={id} name={id} />
      </NumberInput.Control>
    </NumberInput.Root>
  </Field.Root>
);

type PostSeriesMetadataFieldsProps = {
  disabled: boolean;
  draft: SeriesDraft;
  onChange: (field: keyof SeriesDraft, value: string) => void;
};

export const PostSeriesMetadataFields = ({
  disabled,
  draft,
  onChange,
}: PostSeriesMetadataFieldsProps) => (
  <>
    <Field.Root>
      <Field.Label htmlFor="post-anime-title-edit">Anime title</Field.Label>
      <Input
        disabled={disabled}
        id="post-anime-title-edit"
        onChange={(event) => {
          onChange("animeTitle", event.target.value);
        }}
        value={draft.animeTitle}
      />
    </Field.Root>
    <Field.Root>
      <Field.Label htmlFor="post-source-type-edit">Source type</Field.Label>
      <select
        className="border-tone-300 dark:border-tone-600 dark:bg-tone-800 w-full rounded-md border bg-white px-3 py-2 text-sm"
        disabled={disabled}
        id="post-source-type-edit"
        onChange={(event) => {
          onChange("sourceType", event.target.value);
        }}
        value={draft.sourceType}
      >
        <option value="">Not set</option>
        <option value="movie">Movie</option>
        <option value="tv_series">TV series</option>
      </select>
    </Field.Root>
    {/* Literal class needed: Tailwind can't see dynamic grid-cols values. */}
    <div className="grid grid-cols-2 gap-4">
      <SeriesNumberField
        disabled={disabled}
        id="post-season-edit"
        label="Season"
        onChange={(value) => {
          onChange("seasonNumber", value);
        }}
        value={draft.seasonNumber}
      />
      <SeriesNumberField
        disabled={disabled}
        id="post-episode-edit"
        label="Episode"
        onChange={(value) => {
          onChange("episodeNumber", value);
        }}
        value={draft.episodeNumber}
      />
      <SeriesNumberField
        disabled={disabled}
        id="post-volume-edit"
        label="Volume"
        onChange={(value) => {
          onChange("volumeNumber", value);
        }}
        value={draft.volumeNumber}
      />
      <SeriesNumberField
        disabled={disabled}
        id="post-chapter-edit"
        label="Chapter"
        onChange={(value) => {
          onChange("chapterNumber", value);
        }}
        value={draft.chapterNumber}
      />
    </div>
  </>
);
