import { z } from "zod";

import { sanitize } from "../sanitize";

export const createPlaylistInputSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200)
      .transform((val) => sanitize(val)),
    description: z
      .string()
      .max(1000)
      .transform((val) => sanitize(val))
      .optional(),
    isPublic: z.boolean().optional().default(false),
  })
  .strict();

export const updatePlaylistInputSchema = z
  .object({
    playlistId: z.number(),
    title: z
      .string()
      .min(1)
      .max(200)
      .transform((val) => sanitize(val))
      .optional(),
    description: z
      .string()
      .max(1000)
      .transform((val) => sanitize(val))
      .optional(),
    isPublic: z.boolean().optional(),
  })
  .strict();

export const addPostToPlaylistInputSchema = z
  .object({
    playlistId: z.number(),
    postId: z.number(),
  })
  .strict();

export const removePostFromPlaylistInputSchema = addPostToPlaylistInputSchema;

export const reorderPlaylistPostsInputSchema = z
  .object({
    playlistId: z.number(),
    items: z.array(
      z.object({
        postId: z.number(),
        position: z.number(),
      }),
    ),
  })
  .strict();

export const fetchPlaylistDetailSchema = z
  .object({
    playlistId: z.number(),
    page: z.number().min(0).default(0),
  })
  .strict();
