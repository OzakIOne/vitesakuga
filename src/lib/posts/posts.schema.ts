import { Effect, Schema, SchemaGetter } from "effect";

import { PostId } from "../ids";
import { sanitize } from "../sanitize";
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TAGS_COUNT,
  MAX_TAG_NAME_LENGTH,
} from "../search/search-limits";

const CoerceNumber = Schema.Union([Schema.Number, Schema.NumberFromString]);

const OptionalString = Schema.optionalKey(Schema.String);

export const VideoMetadataSchema = Schema.optional(
  Schema.Struct({
    BitDepth: CoerceNumber,
    BitRate: CoerceNumber,
    ChromaSubsampling: OptionalString,
    CodecID: OptionalString,
    ColorSpace: OptionalString,
    DisplayAspectRatio: OptionalString,
    Duration: CoerceNumber,
    Encoded_Library_Name: OptionalString,
    Encoded_Library_Settings: OptionalString,
    Format_Profile: OptionalString,
    FrameCount: CoerceNumber,
    FrameRate: CoerceNumber,
    Height: CoerceNumber,
    Width: CoerceNumber,
    colour_primaries: OptionalString,
  }),
);

export type VideoMetadata = Schema.Schema.Type<typeof VideoMetadataSchema>;

export const TagSchema = Schema.Struct({
  id: Schema.optionalKey(Schema.Number),
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
});

export type Tag = Schema.Schema.Type<typeof TagSchema>;

// Tags attached automatically to every post: videos get "video", image posts
// get "image". The server strips them from user-supplied tag lists (upload
// and edit) before re-appending the correct one, so users can neither see
// them in their tag inputs nor remove them.
export const RESERVED_TAG_NAMES = ["image", "video"] as const;

// Videos upload direct-to-R2 via presigned PUTs, so bytes never buffer in the
// Worker; the cap is a product/cost guard enforced at upload-confirm time.
// Thumbnails still transit the Worker and stay small.
export const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;
export const MAX_THUMBNAIL_SIZE_BYTES = 5 * 1024 * 1024;

const sanitizeString = <S extends Schema.Schema<string>>(schema: S) =>
  schema.pipe(
    Schema.decodeTo(Schema.String, {
      decode: SchemaGetter.transform((val) => sanitize(val)),
      encode: SchemaGetter.transform((val) => val),
    }),
  );

const MinLen3 = Schema.isMinLength(3, {
  message: "You must have a length of at least 3",
});

const HttpsUrl = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^https?:\/\//)),
);

const RelatedPostId = PostId.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

export const FormFileUploadTextSchema = Schema.Struct({
  content: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  relatedPostId: Schema.optional(RelatedPostId),
  source: Schema.optional(Schema.Union([HttpsUrl, Schema.Literal("")])),
  tags: Schema.Array(TagSchema),
  title: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
});

export const VIDEO_EXTENSION_PATTERN = /\.(mp4|avi|mov|wmv|flv|mkv)$/i;

export const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp)$/i;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// The UI currently exposes a single image per post; the schema/storage layer
// already accepts several so raising this constant is enough to lift it.
export const MAX_IMAGES_PER_POST = 5;

const VideoKey = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1, {
      message: "Video upload is missing",
    }),
  ),
);

const ThumbnailFile = Schema.instanceOf(File).pipe(
  Schema.refine((file): file is File => /\.(jpe?g)$/i.test(file.name), {
    message: "Thumbnail must be a JPEG image",
  }),
  Schema.refine(
    (file): file is File =>
      file.size > 0 && file.size <= MAX_THUMBNAIL_SIZE_BYTES,
    {
      message: `Thumbnails must not exceed ${MAX_THUMBNAIL_SIZE_BYTES / (1024 * 1024)} MB`,
    },
  ),
);

const ImageFile = Schema.instanceOf(File).pipe(
  Schema.refine(
    (file): file is File => IMAGE_EXTENSION_PATTERN.test(file.name),
    {
      message: "Images must be JPEG, PNG or WebP files",
    },
  ),
  Schema.refine(
    (file): file is File => file.size > 0 && file.size <= MAX_IMAGE_SIZE_BYTES,
    {
      message: `Images must not exceed ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB`,
    },
  ),
);

export const PostSourceUploadSchema = Schema.optional(
  Schema.Literals(["movie", "tv_series"]),
);

const SharedUploadFields = {
  animeTitle: Schema.optional(sanitizeString(Schema.String)),
  content: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  episodeNumber: Schema.optional(CoerceNumber),
  relatedPostId: Schema.optional(RelatedPostId),
  seasonNumber: Schema.optional(CoerceNumber),
  source: Schema.optional(Schema.Union([HttpsUrl, Schema.Literal("")])),
  sourceType: PostSourceUploadSchema,
  tags: Schema.Array(TagSchema),
  title: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
};

export const FormFileUploadSchema = Schema.Struct({
  ...SharedUploadFields,
  images: Schema.optionalKey(Schema.Array(ImageFile)),
  thumbnail: Schema.optionalKey(ThumbnailFile),
  videoKey: Schema.optionalKey(VideoKey),
  videoMetadata: VideoMetadataSchema,
}).pipe(
  // A post carries exactly one media kind. Videos keep the presigned
  // direct-to-R2 flow (pending key + generated JPEG thumbnail); images
  // transit the Worker and their first image doubles as the card thumbnail.
  Schema.check(
    Schema.makeFilter((value) => {
      const issues: string[] = [];
      const hasVideo = value.videoKey !== undefined;
      const hasImages = (value.images?.length ?? 0) > 0;
      if (hasVideo === hasImages) {
        issues.push("A post must have either a video or images, not both");
      }
      if (hasVideo && value.thumbnail === undefined) {
        issues.push("Video posts require a thumbnail");
      }
      if ((value.images?.length ?? 0) > MAX_IMAGES_PER_POST) {
        issues.push(`At most ${MAX_IMAGES_PER_POST} images per post`);
      }
      if (value.sourceType && !value.animeTitle) {
        issues.push("Anime title is required when the source type is set");
      }
      if (
        value.sourceType === "tv_series" &&
        (value.seasonNumber === undefined || value.episodeNumber === undefined)
      ) {
        issues.push(
          "Season and episode numbers are required for TV series posts",
        );
      }
      return issues;
    }),
  ),
);

export type FileUploadData = Schema.Schema.Type<typeof FormFileUploadSchema>;

export const createVideoUploadUrlSchema = Schema.Struct({
  fileName: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(VIDEO_EXTENSION_PATTERN, {
        message: "Only video files are allowed",
      }),
    ),
  ),
});

export type CreateVideoUploadUrlInput = Schema.Schema.Type<
  typeof createVideoUploadUrlSchema
>;

export const updatePostInputSchema = Schema.Struct({
  content: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  postId: PostId.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  relatedPostId: Schema.optional(RelatedPostId),
  source: Schema.optional(Schema.Union([HttpsUrl, Schema.Literal("")])),
  tags: Schema.Array(TagSchema),
  title: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
});

export const searchPostsBaseSchema = Schema.Struct({
  dateRange: Schema.Literals(["all", "today", "week", "month"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("all")),
  ),
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
  q: Schema.String.pipe(
    Schema.decode({
      decode: SchemaGetter.transform((val) => val.trim()),
      encode: SchemaGetter.transform((val) => val),
    }),
    Schema.check(
      Schema.isMaxLength(MAX_SEARCH_QUERY_LENGTH, {
        message: `Search query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`,
      }),
    ),
    Schema.withDecodingDefault(Effect.succeed("")),
  ),
  sortBy: Schema.Literals(["newest", "oldest"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("newest")),
  ),
  tags: Schema.Array(
    Schema.String.pipe(
      Schema.check(
        Schema.isMaxLength(MAX_TAG_NAME_LENGTH, {
          message: `Tag names must not exceed ${MAX_TAG_NAME_LENGTH} characters`,
        }),
      ),
    ),
  ).pipe(
    Schema.check(
      Schema.isMaxLength(MAX_SEARCH_TAGS_COUNT, {
        message: `Select at most ${MAX_SEARCH_TAGS_COUNT} tags`,
      }),
    ),
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});

export type PostsSearchParams = Schema.Schema.Type<
  typeof searchPostsBaseSchema
>;

export const postByTagSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
  tag: Schema.String,
});
