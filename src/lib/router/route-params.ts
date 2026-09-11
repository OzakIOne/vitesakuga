import { notFound } from "@tanstack/react-router";

import { parse } from "../effect/schema.utils";
import { PositiveIntegerFromString } from "../ids";

/** Decode a canonical positive integer URL segment or enter route-level 404 handling. */
export const parsePositiveIntegerRouteParam = (value: string): number => {
  try {
    return parse(PositiveIntegerFromString)(value);
  } catch {
    throw notFound();
  }
};
