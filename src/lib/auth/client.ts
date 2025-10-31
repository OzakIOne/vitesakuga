import { createAuthClient } from "better-auth/react";
import { envServer } from "src/lib/env/server";

const authClient = createAuthClient({
  baseURL: envServer.VITE_BASE_URL,
});

export default authClient;
