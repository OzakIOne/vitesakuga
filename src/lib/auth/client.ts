import { createAuthClient } from "better-auth/react";
import { envClient } from "src/lib/env/client";

const authClient = createAuthClient({
  // ? Somehow envServer crashes but envClient works here
  baseURL: envClient.VITE_BASE_URL,
});

export default authClient;
