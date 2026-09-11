import { notFound } from "@tanstack/react-router";
import { Schema } from "effect";

import {
  PlaylistNotFoundError,
  PostNotFoundError,
  UserNotFoundError,
} from "../errors";

const ResourceNotFoundError = Schema.Union([
  PlaylistNotFoundError,
  PostNotFoundError,
  UserNotFoundError,
]);

const isResourceNotFoundError = Schema.is(ResourceNotFoundError);

/** Convert domain-level missing resources into TanStack Router's 404 channel. */
export const rethrowRouteDataError = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch bindings are unknown until this boundary validates them against the tagged error union.
  error: unknown,
): never => {
  if (isResourceNotFoundError(error)) throw notFound();
  throw error;
};
