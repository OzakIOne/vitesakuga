import { Layer } from "effect";
import { sql } from "kysely";
import { expect, it } from "vitest";

import { RoleSchema } from "../../auth/roles";
import { makeServiceTestLayer } from "../test-utils";

it("constrains user.role to RoleSchema literals in PostgreSQL", async () => {
  const { db, close } = await makeServiceTestLayer(Layer.empty);
  try {
    for (const role of RoleSchema.literals) {
      await sql`
        INSERT INTO "user" (id, email, name, username, role)
        VALUES (${`role-${role}`}, ${`${role}@test.com`}, ${role}, ${`role-${role}`}, ${role})
      `.execute(db);
    }

    const defaultedUser = await sql<{ role: string }>`
      INSERT INTO "user" (id, email, name, username)
      VALUES ('default-role', 'default-role@test.com', 'Default role', 'default-role')
      RETURNING role
    `.execute(db);
    expect(defaultedUser.rows[0]?.role).toBe("novice");

    await expect(
      sql`
        INSERT INTO "user" (id, email, name, username, role)
        VALUES ('invalid-insert', 'invalid-insert@test.com', 'Invalid insert', 'invalid-insert', 'superuser')
      `.execute(db),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      sql`UPDATE "user" SET role = 'superuser' WHERE id = 'role-novice'`.execute(
        db,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  } finally {
    await close();
  }
});
