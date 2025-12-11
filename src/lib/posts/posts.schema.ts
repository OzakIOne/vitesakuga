import z from "zod";

// Schema for pagination parameters following JSON:API cursor pagination profile
export const fetchPostsInputSchema = z.object({
  page: z
    .object({
      size: z.number().min(1).max(100).default(20), // page[size]
      after: z.number().optional(), // page[after] - cursor for next page
      before: z.number().optional(), // page[before] - cursor for previous page
    })
    .optional()
    .default({ size: 20 }),
});

export const searchPostsInputSchema = z.object({
  q: z.string().trim().min(1),
  page: z
    .object({
      size: z.number().min(1).max(100).default(20),
      after: z.number().optional(),
    })
    .optional()
    .default({ size: 20 }),
});

const TagSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
});

const BaseFormUploadSchema = z.object({
  title: z.string().min(3, "You must have a length of at least 3"),
  content: z.string().min(3, "You must have a length of at least 3"),
  userId: z.string(),
  source: z.url().or(z.literal("")).or(z.undefined()),
  relatedPostId: z.number().or(z.undefined()),
  tags: z.array(TagSchema),
});

export const FileFormUploadSchema = BaseFormUploadSchema.extend({
  video: z.file(),
  thumbnail: z.file(),
});

const BufferSerializableSchema = z.object({
  arrayBuffer: z.instanceof(ArrayBuffer),
  name: z.string(),
  type: z.string(),
  size: z.number(),
});

export type BufferSerializableType = z.infer<typeof BufferSerializableSchema>;

export const BufferFormUploadSchema = BaseFormUploadSchema.extend({
  video: BufferSerializableSchema,
  thumbnail: BufferSerializableSchema,
});

export type SerializedUploadData = z.infer<typeof BufferFormUploadSchema>;

export type FileUploadData = Omit<
  z.infer<typeof FileFormUploadSchema>,
  "video" | "thumbnail"
> & {
  // TODO remove undefined because form ensure the file is present same for thumbnail
  video: File | undefined;
  thumbnail: File | undefined;
};

// Schema for updating a post
export const updatePostInputSchema = z.object({
  postId: z.number(),
  title: z.string().min(3, "You must have a length of at least 3"),
  content: z.string().min(3, "You must have a length of at least 3"),
  source: z.url().or(z.literal("")).or(z.undefined()),
  relatedPostId: z.number().or(z.undefined()),
  tags: z.array(TagSchema),
});

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

export const postSearchSchema = z.object({
  q: z.string().trim().min(1).optional(),
  size: z.coerce.number().min(1).max(100).default(20).optional(),
  sortBy: z.enum(["latest", "oldest"]).default("latest"),
  dateRange: z.enum(["all", "today", "week", "month"]).default("all"),
});

export type PostSearchParams = z.infer<typeof postSearchSchema>;
