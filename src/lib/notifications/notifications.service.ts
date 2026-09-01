import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer } from "effect";

import { SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError } from "../effect/effect.utils";
import { baseLayerFactories, createHandler } from "../server-fn.handler";

export type NotificationType =
  | "edit-suggestion-applied"
  | "promotion-approved"
  | "promotion-rejected";

export type NotificationRow = {
  readonly id: number;
  readonly type: NotificationType;
  readonly readAt: string | null;
  /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
  readonly createdAt: string;
};

const INBOX_PAGE_SIZE = 50;

export class NotificationsService extends Context.Service<
  NotificationsService,
  {
    /**
     * Best-effort notification: a broken inbox must never fail the business
     * event that raised it (an approved promotion stays approved).
     */
    readonly notifyOrLog: (args: {
      readonly userId: string;
      readonly type: NotificationType;
    }) => Effect.Effect<void>;

    /** Newest-first inbox for one user. */
    readonly list: (
      userId: string,
    ) => Effect.Effect<ReadonlyArray<NotificationRow>, SqlError>;

    /** Flips `readAt` on every unread row of the user. */
    readonly markAllRead: (userId: string) => Effect.Effect<void, SqlError>;
  }
>()("NotificationsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const notifyOrLog = Effect.fn("NotificationsService.notifyOrLog")(
      function* (args: { userId: string; type: NotificationType }) {
        yield* db
          .execute(
            db.insertInto("notifications").values({
              type: args.type,
              userId: args.userId,
            }),
          )
          .pipe(
            Effect.catchTag("SqlError", (error) =>
              Effect.logError("Notification insert failed").pipe(
                Effect.annotateLogs({ error: String(error), ...args }),
              ),
            ),
          );
      },
    );

    const list = Effect.fn("NotificationsService.list")(function* (
      userId: string,
    ) {
      const rows = yield* db.execute(
        db
          .selectFrom("notifications")
          .select(["id", "type", "readAt", "createdAt"])
          .where("userId", "=", userId)
          .orderBy("createdAt", "desc")
          .limit(INBOX_PAGE_SIZE),
      );
      return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt ? row.readAt.toISOString() : null,
      }));
    });

    const markAllRead = Effect.fn("NotificationsService.markAllRead")(
      function* (userId: string) {
        const now = yield* DateTime.now;
        yield* db.execute(
          db
            .updateTable("notifications")
            .set({ readAt: DateTime.toDate(now) })
            .where("userId", "=", userId)
            .where("readAt", "is", null),
        );
      },
    );

    return { notifyOrLog, list, markAllRead };
  }),
}) {
  static readonly list = Effect.fn("NotificationsService.list")(function* () {
    const sessions = yield* SessionService;
    const user = yield* sessions.requireUser(
      "You must be logged in to read your notifications",
    );
    const svc = yield* NotificationsService;
    return yield* svc.list(user.id);
  });

  static readonly markAllRead = Effect.fn("NotificationsService.markAllRead")(
    function* () {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to update your notifications",
      );
      const svc = yield* NotificationsService;
      return yield* svc.markAllRead(user.id);
    },
  );
}

export const NotificationsServiceLive = Layer.effect(
  NotificationsService,
  NotificationsService.make,
);

export const fetchNotifications = createServerFn({
  strict: { output: false },
}).handler(
  createHandler(
    NotificationsServiceLive,
    baseLayerFactories.auth,
  )(NotificationsService.list),
);

export const markAllNotificationsRead = createServerFn({
  method: "POST",
}).handler(
  createHandler(
    NotificationsServiceLive,
    baseLayerFactories.auth,
  )(NotificationsService.markAllRead),
);
