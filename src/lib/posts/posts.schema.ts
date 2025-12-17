import z from "zod";

// Schema for pagination parameters following JSON:API cursor pagination profile
export const fetchPostsInputSchema = z.object({
  page: z
    .object({
      after: z.number().optional(), // page[after] - cursor for next page
      before: z.number().optional(), // page[before] - cursor for previous page
      size: z.number().min(1).max(100).default(20), // page[size]
    })
    .optional()
    .default({ size: 20 }),
});

export const searchPostsInputSchema = z.object({
  page: z
    .object({
      after: z.number().optional(),
      size: z.number().min(1).max(100).default(20),
    })
    .optional()
    .default({ size: 20 }),
  q: z.string().trim().default(""),
  tags: z.array(z.string()).default([]),
});

export const fetchUserInputSchema = z.object({
  page: z
    .object({
      after: z.number().optional(),
      size: z.number().min(1).max(100).default(20),
    })
    .optional()
    .default({ size: 20 }),
  q: z.string().trim().default(""),
  tags: z.array(z.string()).default([]),
  userId: z.string(),
});

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
});

const BufferSerializableSchema = z.object({
  arrayBuffer: z.instanceof(ArrayBuffer),
  name: z.string(),
  size: z.number(),
  type: z.string(),
});

export type BufferSerializableType = z.infer<typeof BufferSerializableSchema>;

export const BufferFormUploadSchema = FormBaseUploadSchema.extend({
  thumbnail: BufferSerializableSchema,
  video: BufferSerializableSchema,
});

export type SerializedUploadData = z.infer<typeof BufferFormUploadSchema>;

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

export const postSearchSchema = z.object({
  dateRange: z.enum(["all", "today", "week", "month"]).default("all"),
  q: z.string().trim().default(""),
  size: z.coerce.number().min(1).max(100).default(20).optional(),
  sortBy: z.enum(["latest", "oldest"]).default("latest"),
  tags: z.array(z.string()).default([]),
});

export type PostSearchParams = z.infer<typeof postSearchSchema>;
