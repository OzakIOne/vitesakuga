import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError } from "../db/effect-kysely";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parse } from "../effect/schema.utils";
import { AccountSuspendedError, ForbiddenError, UnauthorizedError } from "../errors";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";

export type NotificationType =
  | "comment-mention"
  | "edit-suggestion-applied"
  | "edit-suggestion-approved"
  | "edit-suggestion-rejected"
  | "promotion-approved"
  | "promotion-rejected";

export type NotificationRow = {
  readonly id: number;
  readonly type: NotificationType;
  /** Post the notification links to (mentions land on the comment thread). */
  readonly postId: number | null;
  readonly readAt: string | null;
  /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
  readonly createdAt: string;
};

const INBOX_PAGE_SIZE = 50;

type InboxError =
  | SqlError
  | AccountSuspendedError
  | ForbiddenError
  | UnauthorizedError
  | SessionFetchError;

const requireInboxReaderId = Effect.fn("NotificationsService.requireInboxReaderId")(
  function* (message: string) {
    const sessions = yield* SessionService;
    const user = yield* sessions.requireReadActor(message);
    return user.id;
  },
);

const requireInboxWriterId = Effect.fn("NotificationsService.requireInboxWriterId")(
  function* (message: string) {
    const sessions = yield* SessionService;
    const user = yield* sessions.requireActor(message);
    return user.id;
  },
);

export class NotificationsService extends Context.Service<
  NotificationsService,
  {
    /** Inserts one inbox row. Callers decide whether a failure matters. */
    readonly notify: (args: {
      readonly userId: string;
      readonly type: NotificationType;
      /** Post the notification links to, when there is a deep link. */
      readonly postId?: number;
    }) => Effect.Effect<void, SqlError>;

    /** Newest-first inbox for one user. */
    readonly list: () => Effect.Effect<
      ReadonlyArray<NotificationRow>,
      InboxError,
      SessionService
    >;

    /** Flips `readAt` on every unread row of the user. */
    readonly markAllRead: () => Effect.Effect<void, InboxError, SessionService>;

    /** Flips one notification's `readAt`, scoped to its owner. */
    readonly markRead: (
      notificationId: number,
    ) => Effect.Effect<void, InboxError, SessionService>;
  }
>()("NotificationsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const notify = Effect.fn("NotificationsService.notify")(function* (args: {
      userId: string;
      type: NotificationType;
      postId?: number;
    }) {
      yield* db.execute(
        db.insertInto("notifications").values({
          type: args.type,
          userId: args.userId,
          postId: args.postId ?? null,
        }),
      );
    });

    const list = Effect.fn("NotificationsService.list")(function* () {
      const userId = yield* requireInboxReaderId(
        "You must be logged in to read your notifications",
      );
      const rows = yield* db.execute(
        db
          .selectFrom("notifications")
          .select(["id", "type", "postId", "readAt", "createdAt"])
          .where("userId", "=", userId)
          .orderBy("createdAt", "desc")
          .limit(INBOX_PAGE_SIZE),
      );
      return rows.map((row) => ({
        ...row,
        createdAt: toIsoTimestamp(row.createdAt),
        readAt: row.readAt ? toIsoTimestamp(row.readAt) : null,
      }));
    });

    const markAllRead = Effect.fn("NotificationsService.markAllRead")(
      function* () {
        const userId = yield* requireInboxWriterId(
          "You must be logged in to update your notifications",
        );
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

    const markRead = Effect.fn("NotificationsService.markRead")(function* (
      notificationId: number,
    ) {
      const userId = yield* requireInboxWriterId(
        "You must be logged in to update your notifications",
      );
      const now = yield* DateTime.now;
      yield* db.execute(
        db
          .updateTable("notifications")
          .set({ readAt: DateTime.toDate(now) })
          .where("id", "=", notificationId)
          .where("userId", "=", userId)
          .where("readAt", "is", null),
      );
    });

    return { notify, list, markAllRead, markRead };
  }),
}) {}

export const NotificationsServiceLive = Layer.effect(
  NotificationsService,
  NotificationsService.make,
);

export const fetchNotifications = createServerFn({
  strict: { output: false },
}).handler(
  createEndpointHandler({
    service: NotificationsService,
    operation: "list",
    layer: NotificationsServiceLive,
    base: baseLayerFactories.auth,
  }),
);

export const markAllNotificationsRead = createServerFn({
  method: "POST",
}).handler(
  createEndpointHandler({
    service: NotificationsService,
    operation: "markAllRead",
    layer: NotificationsServiceLive,
    base: baseLayerFactories.auth,
  }),
);

export const markNotificationRead = createServerFn({ method: "POST" })
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: NotificationsService,
      operation: "markRead",
      layer: NotificationsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
