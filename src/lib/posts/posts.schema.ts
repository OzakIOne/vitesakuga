import DOMPurify from "isomorphic-dompurify";
import z from "zod";

export const VideoMetadataSchema = z
  .object({
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
  })
  .strict();

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

const TagSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().min(1),
  })
  .strict();

export const FormFileUploadSchema = z
  .object({
    content: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => DOMPurify.sanitize(val)),
    relatedPostId: z.number().min(0).or(z.undefined()),
    source: z.url().or(z.literal("")).or(z.undefined()),
    tags: z.array(TagSchema),
    thumbnail: z.instanceof(File),
    title: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => DOMPurify.sanitize(val)),
    userId: z.string(),
    video: z.instanceof(File),
    videoMetadata: VideoMetadataSchema,
  })
  .strict();

export type FileUploadData = z.infer<typeof FormFileUploadSchema>;

export const updatePostInputSchema = z
  .object({
    content: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => DOMPurify.sanitize(val)),
    postId: z.number().min(0),
    relatedPostId: z.number().min(0).or(z.undefined()),
    source: z.url().or(z.literal("")).or(z.undefined()),
    tags: z.array(TagSchema),
    title: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => DOMPurify.sanitize(val)),
  })
  .strict();

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

export const searchPostsBaseSchema = z
  .object({
    dateRange: z.enum(["all", "today", "week", "month"]).default("all"),
    page: z.number().min(0).default(0),
    q: z.string().trim().default(""),
    sortBy: z.enum(["newest", "oldest"]).default("newest"),
    tags: z.array(z.string()).default([]),
  })
  .strict();

export type PostsSearchParams = z.infer<typeof searchPostsBaseSchema>;
