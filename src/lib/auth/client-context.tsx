import { createContext } from "react";

import authClient from "./client";

export const AuthClientContext = createContext(authClient);
