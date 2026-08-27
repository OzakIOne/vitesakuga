import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option } from "effect";

import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError } from "../effect/effect.utils";
import { parseStrict } from "../effect/schema.utils";
import { PostNotFoundError, UnauthorizedError } from "../errors";
import { PostId } from "../ids";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import {
  submitPostReportSchema,
  type SubmitPostReportInput,
} from "./reports.schema";

export type PostReportResult = {
  postId: PostId;
  reported: true;
};

export class PostReportsService extends Context.Service<
  PostReportsService,
  {
    readonly submit: (
      data: SubmitPostReportInput,
    ) => Effect.Effect<
      PostReportResult,
      UnauthorizedError | PostNotFoundError | SessionFetchError | SqlError,
      SessionService
    >;
  }
>()("PostReportsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const submit = Effect.fn("PostReportsService.submit")(function* (
      data: SubmitPostReportInput,
    ) {
      const sessions = yield* SessionService;
      const session = yield* sessions.requireUser(
        "You must be logged in to report posts",
      );

      const postOption = yield* db.executeTakeFirstOption(
        db.selectFrom("posts").select("id").where("id", "=", data.postId),
      );

      yield* Option.match(postOption, {
        onNone: () =>
          Effect.fail(
            new PostNotFoundError({
              message: `Post ${data.postId} not found`,
              postId: data.postId,
            }),
          ),
        onSome: () => Effect.succeed(undefined),
      });

      // One report per user per post; re-reporting updates the latest reason.
      yield* db.execute(
        db
          .insertInto("post_reports")
          .values({
            postId: data.postId,
            reason: data.reason,
            userId: session.id,
          })
          .onConflict((oc) =>
            oc
              .columns(["postId", "userId"])
              .doUpdateSet({ reason: data.reason }),
          ),
      );

      yield* Effect.logInfo("Post reported").pipe(
        Effect.annotateLogs({
          postId: String(data.postId),
          reason: data.reason,
          userId: session.id,
        }),
      );

      return { postId: data.postId, reported: true as const };
    });

    return { submit };
  }),
}) {
  static readonly submit = Effect.fn("PostReportsService.submit")(function* (
    data: SubmitPostReportInput,
  ) {
    const svc = yield* PostReportsService;
    return yield* svc.submit(data);
  });
}

export const PostReportsServiceLive = Layer.effect(
  PostReportsService,
  PostReportsService.make,
);

export const submitPostReport = createServerFn({ method: "POST" })
  .validator(parseStrict(submitPostReportSchema))
  .handler(
    createHandler(
      PostReportsServiceLive,
      baseLayerFactories.auth,
    )(PostReportsService.submit),
  );
