import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { envClient } from "src/lib/env/client";

const authClient = createAuthClient({
  // ? Somehow envServer crashes but envClient works here
  baseURL: envClient.VITE_BASE_URL,
  plugins: [
    passkeyClient(),
    twoFactorClient({
      // Full page load on the 2FA challenge: the pending challenge is stored
      // in the `better-auth.two_factor` cookie, so it survives the reload.
      twoFactorPage: "/two-factor",
    }),
    // Mirrors the server `username` plugin (displayUsername disabled there).
    usernameClient({ displayUsername: false }),
  ],
});

export default authClient;
