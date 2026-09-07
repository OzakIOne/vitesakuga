import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";

import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parseStrict } from "../effect/schema.utils";
import { UnauthorizedError, ValidationError } from "../errors";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import {
  deleteSavedSearchInputSchema,
  saveSearchInputSchema,
  type SavedSearch,
} from "./saved-searches.schema";

type SavedSearchDbRow = {
  created_at: Date | string;
  date_range: SavedSearch["date_range"];
  id: number;
  name: string;
  q: string;
  sort_by: SavedSearch["sort_by"];
  tags: string[];
  user_id: string;
};

const toSavedSearch = (row: SavedSearchDbRow): SavedSearch => ({
  created_at: toIsoTimestamp(row.created_at),
  date_range: row.date_range,
  id: row.id,
  name: row.name,
  q: row.q,
  sort_by: row.sort_by,
  tags: row.tags,
});

export class SavedSearchesService extends Context.Service<
  SavedSearchesService,
  {
    readonly save: (
      data: Schema.Schema.Type<typeof saveSearchInputSchema>,
    ) => Effect.Effect<
      SavedSearch,
      | UnauthorizedError
      | SessionFetchError
      | SqlError
      | SqlNoFirstResult
      | ValidationError,
      SessionService
    >;
    readonly list: () => Effect.Effect<
      readonly SavedSearch[],
      UnauthorizedError | SessionFetchError | SqlError,
      SessionService
    >;
    readonly delete_: (
      id: number,
    ) => Effect.Effect<
      { success: boolean },
      UnauthorizedError | SessionFetchError | SqlError,
      SessionService
    >;
  }
>()("SavedSearchesService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const requireAuth = Effect.fn("SavedSearchesService.requireAuth")(
      function* () {
        const sessions = yield* SessionService;
        return yield* sessions.requireUser("You must be logged in");
      },
    );

    const save = Effect.fn("SavedSearchesService.save")(function* (
      data: Schema.Schema.Type<typeof saveSearchInputSchema>,
    ) {
      const user = yield* requireAuth();
      const existing = yield* db.executeTakeFirstOption(
        db
          .selectFrom("saved_searches")
          .select("id")
          .where("user_id", "=", user.id)
          .where("name", "=", data.name),
      );
      if (Option.isSome(existing)) {
        return yield* new ValidationError({
          message: "A saved search with this name already exists",
        });
      }

      const row = yield* db.executeTakeFirstOrError(
        db
          .insertInto("saved_searches")
          .values({
            date_range: data.dateRange,
            name: data.name,
            q: data.q,
            sort_by: data.sortBy,
            tags: [...data.tags],
            user_id: user.id,
          })
          .returningAll(),
      );

      return toSavedSearch(row);
    });

    const list = Effect.fn("SavedSearchesService.list")(function* () {
      const user = yield* requireAuth();
      const rows = yield* db.execute(
        db
          .selectFrom("saved_searches")
          .selectAll()
          .where("user_id", "=", user.id)
          .orderBy("created_at", "desc"),
      );

      return rows.map(toSavedSearch);
    });

    const delete_ = Effect.fn("SavedSearchesService.delete")(function* (
      id: number,
    ) {
      const user = yield* requireAuth();
      yield* db.execute(
        db
          .deleteFrom("saved_searches")
          .where("id", "=", id)
          .where("user_id", "=", user.id),
      );

      return { success: true };
    });

    return { delete_, list, save };
  }),
}) {
  static readonly save = Effect.fn("SavedSearchesService.save")(function* (
    data: Schema.Schema.Type<typeof saveSearchInputSchema>,
  ) {
    const service = yield* SavedSearchesService;
    return yield* service.save(data);
  });

  static readonly list = Effect.fn("SavedSearchesService.list")(function* () {
    const service = yield* SavedSearchesService;
    return yield* service.list();
  });

  static readonly delete_ = Effect.fn("SavedSearchesService.delete")(function* (
    id: number,
  ) {
    const service = yield* SavedSearchesService;
    return yield* service.delete_(id);
  });
}

export const SavedSearchesServiceLive = Layer.effect(
  SavedSearchesService,
  SavedSearchesService.make,
);

export const saveSearch = createServerFn({ method: "POST" })
  .validator(parseStrict(saveSearchInputSchema))
  .handler(
    createHandler(
      SavedSearchesServiceLive,
      baseLayerFactories.auth,
    )(SavedSearchesService.save),
  );

export const fetchSavedSearches = createServerFn({
  strict: { output: false },
}).handler(
  createHandler(
    SavedSearchesServiceLive,
    baseLayerFactories.auth,
  )(() => SavedSearchesService.list()),
);

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .validator(parseStrict(deleteSavedSearchInputSchema))
  .handler(
    createHandler(
      SavedSearchesServiceLive,
      baseLayerFactories.auth,
    )(({ id }: { id: number }) => SavedSearchesService.delete_(id)),
  );
