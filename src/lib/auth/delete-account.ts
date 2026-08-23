import { createServerFn } from "@tanstack/react-start";
import { verifyPassword } from "better-auth/crypto";
import { Context, Effect, Layer, Schema } from "effect";

import { KyselyDB } from "../db/context";
import { DELETED_USER_NAME } from "../db/schema";
import { SqlError } from "../effect/effect.utils";
import { parseStrict } from "../effect/schema.utils";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { SessionFetchError, SessionService } from "./session.effect";

export const deleteAccountInputSchema = Schema.Struct({
  password: Schema.optionalKey(Schema.String),
});

/**
 * Account deletion that anonymizes instead of hard-deleting.
 *
 * The `user` row is kept as an inert shell so public content keeps working:
 * posts and comments stay visible through their `userId` joins, now
 * attributed to DELETED_USER_NAME ("Deleted user"). Everything that could
 * identify or re-authenticate the person is removed:
 *
 * - name/image/email scrubbed (email replaced by an unusable placeholder,
 *   which also frees the address for a future sign-up)
 * - sessions, credential/OAuth accounts (password hashes, tokens), passkeys
 *   and two-factor secrets deleted
 * - playlists (personal data) deleted with their playlist_posts entries
 *
 * Votes are kept on purpose: they only carry the (now anonymous) user id and
 * dropping them would silently change public vote counts.
 */
export class DeleteAccountService extends Context.Service<
  DeleteAccountService,
  {
    readonly deleteAccount: (
      input: Schema.Schema.Type<typeof deleteAccountInputSchema>,
    ) => Effect.Effect<
      { deletedUserId: string },
      ForbiddenError | SessionFetchError | SqlError | UnauthorizedError,
      SessionService
    >;
  }
>()("DeleteAccountService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const deleteAccount = Effect.fn("DeleteAccountService.deleteAccount")(
      function* (input: Schema.Schema.Type<typeof deleteAccountInputSchema>) {
        const sessions = yield* SessionService;
        const user = yield* sessions.requireUser("You must be logged in");
        const userId = user.id;

        // Mirrors Better Auth's `shouldRequirePassword`: a password is only
        // required when the user has a credential account storing a password.
        const credentialAccount = yield* db.executeTakeFirstOrUndefined(
          db
            .selectFrom("account")
            .select("password")
            .where("userId", "=", userId)
            .where("providerId", "=", "credential"),
        );
        const passwordHash = credentialAccount?.password ?? null;

        if (passwordHash) {
          const providedPassword = input.password?.trim() ?? "";
          if (!providedPassword) {
            return yield* new ForbiddenError({
              message: "Your password is required to delete your account",
            });
          }

          const isValidPassword = yield* Effect.tryPromise({
            try: () =>
              verifyPassword({
                hash: passwordHash,
                password: providedPassword,
              }),
            catch: (cause) =>
              new SqlError({
                cause,
                message: "Failed to verify password",
              }),
          });

          if (!isValidPassword) {
            return yield* new ForbiddenError({
              message: "Incorrect password",
            });
          }
        }

        const anonymizedAt = new Date();
        const placeholderEmail = `deleted-${userId}@deleted.local`;

        yield* db.transaction().execute((trx) =>
          Effect.gen(function* () {
            yield* trx.execute(
              trx
                .updateTable("user")
                .set({
                  deletedAt: anonymizedAt,
                  email: placeholderEmail,
                  emailVerified: false,
                  image: null,
                  name: DELETED_USER_NAME,
                  twoFactorEnabled: false,
                  updatedAt: anonymizedAt,
                })
                .where("id", "=", userId),
            );

            yield* trx.execute(
              trx.deleteFrom("session").where("userId", "=", userId),
            );
            yield* trx.execute(
              trx.deleteFrom("account").where("userId", "=", userId),
            );
            yield* trx.execute(
              trx.deleteFrom("passkey").where("userId", "=", userId),
            );
            yield* trx.execute(
              trx.deleteFrom("twoFactor").where("userId", "=", userId),
            );

            yield* trx.execute(
              trx
                .deleteFrom("playlist_posts")
                .where(
                  "playlist_id",
                  "in",
                  trx
                    .selectFrom("playlists")
                    .select("id")
                    .where("user_id", "=", userId),
                ),
            );
            yield* trx.execute(
              trx.deleteFrom("playlists").where("user_id", "=", userId),
            );
          }),
        );

        return { deletedUserId: userId };
      },
    );

    return { deleteAccount };
  }),
}) {
  static readonly deleteAccount = Effect.fn(
    "DeleteAccountService.deleteAccount",
  )(function* (input: Schema.Schema.Type<typeof deleteAccountInputSchema>) {
    const svc = yield* DeleteAccountService;
    return yield* svc.deleteAccount(input);
  });
}

export const DeleteAccountServiceLive = Layer.effect(
  DeleteAccountService,
  DeleteAccountService.make,
);

export const deleteAccount = createServerFn()
  .validator(parseStrict(deleteAccountInputSchema))
  .handler(
    createHandler(
      DeleteAccountServiceLive,
      baseLayerFactories.auth,
    )(DeleteAccountService.deleteAccount),
  );
