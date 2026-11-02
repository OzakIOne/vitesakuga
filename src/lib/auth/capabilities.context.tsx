import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import {
  hasPermission,
  hasPermissionOnOwned,
  type Permission,
  type UserCapabilities,
} from "./capabilities";

export const CapabilitiesContext = createContext<UserCapabilities | null>(null);

export const CapabilitiesProvider = (input: {
  readonly capabilities: UserCapabilities;
  readonly children: ReactNode;
}) => (
  <CapabilitiesContext.Provider value={input.capabilities}>
    {input.children}
  </CapabilitiesContext.Provider>
);

export const useCapabilities = () => {
  const capabilities = useContext(CapabilitiesContext);
  if (capabilities === null) {
    throw new Error("CapabilitiesProvider is missing");
  }

  const can = (permission: Permission) =>
    hasPermission({ capabilities, permission });
  const canOnOwned = (input: {
    readonly ownerId: string;
    readonly own: Permission;
    readonly any?: Permission | undefined;
  }) => hasPermissionOnOwned({ ...input, capabilities });

  return { ...capabilities, can, canOnOwned };
};
