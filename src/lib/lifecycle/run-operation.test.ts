import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KyselyDB } from "../db/context";
import { makeServiceTestLayer } from "../db/test-utils";
import {
  LifecycleInputError,
  LifecycleService,
  LifecycleServiceLive,
  OperationConflictError,
  OperationReplayError,
} from "./lifecycle.service";

const userId = "run-operation-user";
const operationKey = "run-operation-key";

type CreateOutcome = {
  readonly outcome: "created" | "replayed";
  readonly postId: number;
};

let context: Awaited<
  ReturnType<typeof makeServiceTestLayer<LifecycleService, never>>
>;

beforeEach(async () => {
  context = await makeServiceTestLayer(LifecycleServiceLive);
  await context.db
    .insertInto("user")
    .values({
      email: "run-operation@test.invalid",
      id: userId,
      name: "Run Operation",
      username: "run_operation",
    })
    .execute();
});

afterEach(async () => {
  await context.close();
});

const createPost = (options: {
  readonly fail?: boolean;
  readonly key?: string;
  readonly title: string;
}) =>
  Effect.gen(function* () {
    const lifecycle = yield* LifecycleService;
    const db = yield* KyselyDB;
    return yield* lifecycle.runOperation({
      kind: "post-update",
      operationKey: options.key ?? operationKey,
      replay: (result): Effect.Effect<CreateOutcome> =>
        Effect.succeed({ outcome: "replayed", postId: result.postId }),
      request: { payload: { title: options.title } },
      run: (operation) =>
        Effect.gen(function* () {
          if (options.fail === true) {
            return yield* Effect.fail(new Error("run failed before finishing"));
          }
          const postId = yield* db.transaction((trx) =>
            Effect.gen(function* () {
              const row = yield* trx.executeTakeFirstOrError(
                trx
                  .insertInto("posts")
                  .values({
                    description: "run operation",
                    thumbnailKey: "thumb.jpg",
                    title: options.title,
                    userId,
                    videoMetadata: "{}",
                  })
                  .returning("id"),
              );
              yield* operation.finish(trx, { postId: row.id });
              return row.id;
            }),
          );
          return { outcome: "created" as const, postId };
        }),
      userId,
    });
  });

const createPostWithThumbnailKey = (thumbnailKey: string) =>
  Effect.gen(function* () {
    const lifecycle = yield* LifecycleService;
    const db = yield* KyselyDB;
    return yield* lifecycle.runOperation({
      kind: "post-create",
      operationKey,
      replay: () => Effect.void,
      request: { payload: { thumbnailKey } },
      run: (operation) =>
        db.transaction((trx) =>
          Effect.gen(function* () {
            const row = yield* trx.executeTakeFirstOrError(
              trx
                .insertInto("posts")
                .values({
                  description: "url key",
                  thumbnailKey,
                  title: "url key",
                  userId,
                  videoMetadata: "{}",
                })
                .returning("id"),
            );
            yield* operation.finish(trx, {
              imageKeys: [],
              postId: row.id,
              thumbnailKey,
            });
          }),
        ),
      userId,
    });
  });

const postCount = () =>
  context.db
    .selectFrom("posts")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirstOrThrow()
    .then((row) => Number(row.count));

const operationRow = () =>
  context.db
    .selectFrom("media_operations")
    .selectAll()
    .where("userId", "=", userId)
    .where("operationKey", "=", operationKey)
    .executeTakeFirstOrThrow();

describe("LifecycleService.runOperation", () => {
  it("runs once, finishes the operation and stores its typed result", async () => {
    const first = await context.runEffect(createPost({ title: "first" }));

    expect(first.outcome).toBe("created");
    const row = await operationRow();
    expect(row.status).toBe("completed");
    expect(row.result).toEqual({ postId: first.postId });
  });

  it("replays the same key and request from the decoded stored result", async () => {
    const first = await context.runEffect(createPost({ title: "first" }));
    const replay = await context.runEffect(createPost({ title: "first" }));

    expect(replay).toEqual({ outcome: "replayed", postId: first.postId });
    expect(await postCount()).toBe(1);
  });

  it("fails with OperationConflictError when the key carries another request", async () => {
    await context.runEffect(createPost({ title: "first" }));

    const failure = await context.runFailure(createPost({ title: "other" }));

    expect(failure).toBeInstanceOf(OperationConflictError);
    expect(await postCount()).toBe(1);
  });

  it("fails with OperationReplayError when a completed result is missing", async () => {
    await context.runEffect(createPost({ title: "first" }));
    await context.db
      .updateTable("media_operations")
      .set({ result: null })
      .where("userId", "=", userId)
      .where("operationKey", "=", operationKey)
      .execute();

    const failure = await context.runFailure(createPost({ title: "first" }));

    expect(failure).toBeInstanceOf(OperationReplayError);
  });

  it("rejects a URL-valued storage key at finish and leaves the operation retryable", async () => {
    const failure = await context.runFailure(
      createPostWithThumbnailKey("https://cdn.example.test/thumb.jpg"),
    );

    expect(failure).toBeInstanceOf(LifecycleInputError);
    expect(await postCount()).toBe(0);
    const row = await operationRow();
    expect(row.status).toBe("in-progress");
  });

  it("leaves a failed run retryable under a fresh fence", async () => {
    const failure = await context.runFailure(
      createPost({ fail: true, title: "first" }),
    );
    expect(failure).toBeInstanceOf(Error);
    const pending = await operationRow();
    expect(pending.status).toBe("in-progress");
    expect(pending.fence).toBe(1);

    const retried = await context.runEffect(createPost({ title: "first" }));

    expect(retried.outcome).toBe("created");
    const completed = await operationRow();
    expect(completed.status).toBe("completed");
    expect(completed.fence).toBe(2);
    expect(await postCount()).toBe(1);
  });
});
