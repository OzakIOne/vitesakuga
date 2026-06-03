import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import z from "zod";

import { createHandler } from "../server-fn.handler";
import { fetchUserInputSchema } from "../users/users.schema";
import { UsersService, UsersServiceLive } from "../users/users.service";

export const fetchUsersEffect = Effect.fn("fetchUsers")(function* () {
  const svc = yield* UsersService;
  return yield* svc.all();
});

export const fetchUserPostsEffect = Effect.fn("fetchUserPosts")(function* (
  data: z.infer<typeof fetchUserInputSchema>,
) {
  const svc = yield* UsersService;
  return yield* svc.userPosts(data);
});

export const fetchUsers = createServerFn().handler(
  createHandler(fetchUsersEffect, UsersServiceLive),
);

export const fetchUserPosts = createServerFn()
  .inputValidator((input: unknown) => fetchUserInputSchema.parse(input))
  .handler(createHandler(fetchUserPostsEffect, UsersServiceLive));
