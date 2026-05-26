import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";
import z from "zod";

import { UsersService, UsersServiceLive } from "../users/users.service";
import { fetchUserInputSchema } from "../users/users.schema";

const importFactories = () => import("../db/layer-factories.server");

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

// ---- createServerFn wrappers ----

export const fetchUsers = createServerFn().handler(async () => {
  const { makeDBLayer } = await importFactories();
  const dbLayer = await makeDBLayer();
  const layer = UsersServiceLive.pipe(Layer.provideMerge(dbLayer));
  return Effect.runPromise(fetchUsersEffect().pipe(Effect.provide(layer)));
});

export const fetchUserPosts = createServerFn()
  .inputValidator((input: unknown) => fetchUserInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await importFactories();
    const dbLayer = await makeDBLayer();
    const layer = UsersServiceLive.pipe(Layer.provideMerge(dbLayer));
    return Effect.runPromise(
      fetchUserPostsEffect(data).pipe(Effect.provide(layer)),
    );
  });
