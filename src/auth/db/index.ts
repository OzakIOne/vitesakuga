import { serverOnly } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "~/auth/db/schema";

const driver = postgres(process.env.DATABASE_URL!);

const getDatabase = serverOnly(() =>
  drizzle({ client: driver, schema, casing: "snake_case" })
);

export const db = getDatabase();
