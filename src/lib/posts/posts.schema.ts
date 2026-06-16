import z from "zod";

import { sanitize } from "../sanitize";
export const VideoMetadataSchema = z
  .object({
    BitDepth: z.coerce.number(),
    BitRate: z.coerce.number(),
    ChromaSubsampling: z.string().optional(),
    CodecID: z.string().optional(),
    ColorSpace: z.string().optional(),
    DisplayAspectRatio: z.string().optional(),
    Duration: z.coerce.number(),
    Encoded_Library_Name: z.string().optional(),
    Encoded_Library_Settings: z.string().optional(),
    Format_Profile: z.string().optional(),
    FrameCount: z.coerce.number(),
    FrameRate: z.coerce.number(),
    Height: z.coerce.number(),
    Width: z.coerce.number(),
    colour_primaries: z.string().optional(),
  })
  .optional();

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

const TagSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().min(1),
  })
  .strict();

export type Tag = { id?: number; name: string };

export const FormFileUploadTextSchema = z
  .object({
    content: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => sanitize(val)),
    relatedPostId: z.number().min(0).or(z.undefined()),
    source: z
      .url({
        protocol: /^https?$/,
        error: "URL must start with https:",
      })
      .or(z.literal(""))
      .or(z.undefined()),
    tags: z.array(TagSchema),
    title: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => sanitize(val)),
  })
  .loose();

export const FormFileUploadSchema = FormFileUploadTextSchema.extend({
  userId: z.string(),
  video: z
    .instanceof(File)
    .refine((file) => /\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(file.name), {
      message: "Only video files are allowed",
    }),
  thumbnail: z.instanceof(File),
  videoMetadata: VideoMetadataSchema,
}).strict();

export type FileUploadData = z.infer<typeof FormFileUploadSchema>;

export const updatePostInputSchema = z
  .object({
    content: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => sanitize(val)),
    postId: z.number().min(0),
    relatedPostId: z.number().min(0).or(z.undefined()),
    source: z.url().or(z.literal("")).or(z.undefined()),
    tags: z.array(TagSchema),
    title: z
      .string()
      .min(3, "You must have a length of at least 3")
      .transform((val) => sanitize(val)),
  })
  .strict();

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

export const postByTagSchema = z
  .object({
    page: z.number().min(0).default(0),
    tag: z.string(),
  })
  .strict();

export type PostByTagParams = z.infer<typeof postByTagSchema>;
