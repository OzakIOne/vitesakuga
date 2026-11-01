import { Layer } from "effect";
import { expect, it } from "vitest";

import { makeServiceTestLayer } from "../db/test-utils";
import { USERNAME_MAX_LENGTH, USERNAME_PATTERN } from "../mentions/mentions";
import { generateUsername } from "./username.server";

it("returns the display name's slug when that handle is free", async () => {
  const ctx = await makeServiceTestLayer(Layer.empty);
  try {
    const username = await generateUsername({
      db: ctx.db,
      name: "Alice Dupont",
    });

    expect(username).toBe("alice_dupont");
  } finally {
    await ctx.close();
  }
});

it("never hands out a handle that another user already holds", async () => {
  const ctx = await makeServiceTestLayer(Layer.empty);
  try {
    await ctx.db
      .insertInto("user")
      .values({
        email: "alice@test.com",
        id: "user-1",
        name: "Alice",
        username: "alice",
      })
      .execute();

    const username = await generateUsername({ db: ctx.db, name: "Alice" });
    const holder = await ctx.db
      .selectFrom("user")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirst();

    expect(username).not.toBe("alice");
    expect(username.startsWith("alice_")).toBe(true);
    expect(USERNAME_PATTERN.test(username)).toBe(true);
    expect(holder).toBeUndefined();
  } finally {
    await ctx.close();
  }
});

it("keeps a generated handle within the username length limit", async () => {
  const ctx = await makeServiceTestLayer(Layer.empty);
  try {
    const username = await generateUsername({
      db: ctx.db,
      name: "A".repeat(60),
    });

    expect(username.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
    expect(USERNAME_PATTERN.test(username)).toBe(true);
  } finally {
    await ctx.close();
  }
});
