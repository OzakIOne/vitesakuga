import { z } from "zod";

export const userIdSchema = z.coerce.string();
