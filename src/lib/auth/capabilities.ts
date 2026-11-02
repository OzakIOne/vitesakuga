/**
 * Single source of truth for every enforced right in the app, as `domain:action`
 * pairs. A right that a service checks must be named here; a name that no
 * service checks grants nothing. Adding an entry widens the `Permission` union
 * at compile time, so a typo is a type error, not an authorization hole.
 */
export const PERMISSION_CATALOG = [
  "audit:view",
  "comments:delete-any",
  "comments:delete-own",
  "comments:edit-any",
  "comments:edit-own",
  "edits:approve",
  "moderation:view",
  "playlists:edit-own",
  "posts:create",
  "posts:delete-any",
  "posts:delete-own",
  "posts:edit-any",
  "posts:edit-own",
  "posts:suggest-edit",
  "promotions:review",
  "roles:assign",
  "storage:maintain",
  "users:suspend",
  "users:suspend-staff",
  "videos:replace-any",
  "videos:replace-own",
] as const;

export type Permission = (typeof PERMISSION_CATALOG)[number];

export type UserCapabilities = {
  readonly actorId: string | null;
  readonly permissions: ReadonlyArray<Permission>;
  readonly hasMutationActor: boolean;
  readonly suspended: boolean;
  readonly suspensionReason: string | null;
};

export const EMPTY_USER_CAPABILITIES: UserCapabilities = {
  actorId: null,
  hasMutationActor: false,
  permissions: [],
  suspended: false,
  suspensionReason: null,
};

export const hasPermission = (input: {
  readonly capabilities: UserCapabilities;
  readonly permission: Permission;
}): boolean =>
  input.capabilities.hasMutationActor &&
  !input.capabilities.suspended &&
  input.capabilities.permissions.includes(input.permission);

export const hasPermissionOnOwned = (input: {
  readonly capabilities: UserCapabilities;
  readonly ownerId: string;
  readonly own: Permission;
  readonly any?: Permission | undefined;
}): boolean => {
  const ownsResource = input.capabilities.actorId === input.ownerId;
  if (ownsResource) {
    return hasPermission({
      capabilities: input.capabilities,
      permission: input.own,
    });
  }
  return (
    input.any !== undefined &&
    hasPermission({ capabilities: input.capabilities, permission: input.any })
  );
};
