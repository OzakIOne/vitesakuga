import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { Effect } from "effect";

/** Only an existing bucket owned by this account is a successful setup. */
export const ensureTestBucket = (client: S3Client, bucket: string) =>
  Effect.tryPromise({
    try: () => client.send(new CreateBucketCommand({ Bucket: bucket })),
    catch: (cause) => cause,
  }).pipe(
    Effect.catch((error) =>
      error instanceof BucketAlreadyOwnedByYou
        ? Effect.void
        : Effect.fail(error),
    ),
    Effect.asVoid,
  );
