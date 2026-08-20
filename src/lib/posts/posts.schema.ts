import { Effect, Schema, SchemaGetter } from "effect";

import { sanitize } from "../sanitize";

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

const RelatedPostId = Schema.Number.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);

export const FormFileUploadTextSchema = Schema.Struct({
  content: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  relatedPostId: Schema.optional(RelatedPostId),
  source: Schema.optional(Schema.Union([HttpsUrl, Schema.Literal("")])),
  tags: Schema.Array(TagSchema),
  title: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
});

const VideoFile = Schema.instanceOf(File).pipe(
  Schema.refine(
    (file): file is File => /\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(file.name),
    { message: "Only video files are allowed" },
  ),
);

export const FormFileUploadSchema = Schema.Struct({
  content: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  relatedPostId: Schema.optional(RelatedPostId),
  source: Schema.optional(Schema.Union([HttpsUrl, Schema.Literal("")])),
  tags: Schema.Array(TagSchema),
  thumbnail: Schema.instanceOf(File),
  title: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  video: VideoFile,
  videoMetadata: VideoMetadataSchema,
});

export type FileUploadData = Schema.Schema.Type<typeof FormFileUploadSchema>;

export const updatePostInputSchema = Schema.Struct({
  content: sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  postId: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
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
    Schema.withDecodingDefault(Effect.succeed("")),
  ),
  sortBy: Schema.Literals(["newest", "oldest"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("newest")),
  ),
  tags: Schema.Array(Schema.String).pipe(
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
