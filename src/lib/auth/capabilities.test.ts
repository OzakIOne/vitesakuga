import { describe, expect, it } from "vitest";

import {
  hasPermission,
  hasPermissionOnOwned,
  type UserCapabilities,
} from "./capabilities";

describe("client capabilities", () => {
  it("fails closed when a non-mutation actor carries a permission", () => {
    const capabilities: UserCapabilities = {
      actorId: "suspended-1",
      hasMutationActor: false,
      permissions: ["posts:create"],
      suspended: true,
      suspensionReason: "Spam links",
    };

    expect(hasPermission({ capabilities, permission: "posts:create" })).toBe(
      false,
    );
    expect(
      hasPermissionOnOwned({
        capabilities,
        ownerId: "suspended-1",
        own: "posts:edit-own",
        any: "posts:edit-any",
      }),
    ).toBe(false);
  });
});
