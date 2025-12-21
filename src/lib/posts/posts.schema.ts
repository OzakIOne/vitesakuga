import z from "zod";

export const VideoMetadataSchema = z.object({
  BitDepth: z.coerce.number(),
  BitRate: z.coerce.number(),
  ChromaSubsampling: z.string(),
  CodecID: z.string(),
  ColorSpace: z.string(),
  colour_primaries: z.string(),
  DisplayAspectRatio: z.string(),
  Duration: z.coerce.number(),
  Encoded_Library_Name: z.string(),
  Encoded_Library_Settings: z.string(),
  Format_Profile: z.string(),
  FrameCount: z.coerce.number(),
  FrameRate: z.coerce.number(),
  Height: z.coerce.number(),
  Width: z.coerce.number(),
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

const TagSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
});

const FormBaseUploadSchema = z.object({
  content: z.string().min(3, "You must have a length of at least 3"),
  relatedPostId: z.number().or(z.undefined()),
  source: z.url().or(z.literal("")).or(z.undefined()),
  tags: z.array(TagSchema),
  title: z.string().min(3, "You must have a length of at least 3"),
  userId: z.string(),
});

export const FormFileUploadSchema = FormBaseUploadSchema.extend({
  thumbnail: z.file(),
  video: z.file(),
  videoMetadata: VideoMetadataSchema,
});

const BufferSerializableSchema = z.object({
  arrayBuffer: z.instanceof(ArrayBuffer),
  name: z.string(),
  size: z.number(),
  type: z.string(),
});

export type BufferSerializableType = z.infer<typeof BufferSerializableSchema>;

// Server Function requires file as Buffer
export const BufferFormUploadSchema = FormBaseUploadSchema.extend({
  thumbnail: BufferSerializableSchema,
  video: BufferSerializableSchema,
  videoMetadata: z.json(),
});

export type SerializedUploadData = z.infer<typeof BufferFormUploadSchema>;

// Overwrite the types of video and thumbnail to file because TS yells about zod File Type in tanstack form
export type FileUploadData = Omit<
  z.infer<typeof FormFileUploadSchema>,
  "video" | "thumbnail"
> & {
  // TODO remove undefined because form ensure the file is present same for thumbnail
  video: File | undefined;
  thumbnail: File | undefined;
};

// Schema for updating a post
export const updatePostInputSchema = z.object({
  content: z.string().min(3, "You must have a length of at least 3"),
  postId: z.number(),
  relatedPostId: z.number().or(z.undefined()),
  source: z.url().or(z.literal("")).or(z.undefined()),
  tags: z.array(TagSchema),
  title: z.string().min(3, "You must have a length of at least 3"),
});

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

const searchPostsBaseSchema = z.object({
  dateRange: z.enum(["all", "today", "week", "month"]).default("all"),
  q: z.string().trim().default(""),
  sortBy: z.enum(["newest", "oldest"]).default("newest"),
  tags: z.array(z.string()).default([]),
});

export const searchPostsServerSchema = searchPostsBaseSchema.extend({
  page: z
    .object({
      offset: z.number().min(0).default(0),
      size: z.number().min(1).max(100).default(20),
    })
    .optional()
    .default({ offset: 0, size: 20 }),
});

export const postsSearchSchema = searchPostsBaseSchema.extend({
  page: z.number().int().min(1).optional().default(1),
});

export type PostsSearchParams = z.infer<typeof postsSearchSchema>;
