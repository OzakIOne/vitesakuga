import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { useCallback, useContext, useEffect } from "react";
import { LuFingerprint } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { getSafeAuthRedirectUrl } from "src/lib/auth/auth-redirect";
import { useSignInWithPasskey } from "src/lib/auth/auth.hooks";
import { AuthClientContext } from "src/lib/auth/client-context";
import {
  clearTwoFactorRedirectUrl,
  setTwoFactorRedirectUrl,
} from "src/lib/auth/two-factor.hooks";
import { TwoFactorRedirectSchema } from "src/lib/auth/two-factor.schema";
import { envClient } from "src/lib/env/client";
import { usersKeys } from "src/lib/users/users.queries";

type PasskeySignInButtonProps = {
  redirectUrl: string;
  onError?: (message: string) => void;
};

/**
 * Sign-in button for passkeys, including Conditional UI (browser autofill).
 * Requires at least one input with `autocomplete="... webauthn"` on the page
 * for the autofill prompt to appear.
 */
export function PasskeySignInButton({
  redirectUrl,
  onError,
}: PasskeySignInButtonProps) {
  const { isPending, mutate } = useSignInWithPasskey(redirectUrl);
  const authClient = useContext(AuthClientContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const safeRedirectUrl = getSafeAuthRedirectUrl(redirectUrl);

  const redirectAfterLogin = useCallback(async () => {
    clearTwoFactorRedirectUrl();
    await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
    await navigate({ to: safeRedirectUrl });
  }, [queryClient, navigate, safeRedirectUrl]);

  useEffect(() => {
    // WebAuthn only works same-origin: when the page is served from a
    // different origin than the auth API (e.g. `nub run dev` at localhost with
    // a remote VITE_BASE_URL), skip the automatic autofill prompt.
    if (window.location.origin !== new URL(envClient.VITE_BASE_URL).origin) {
      return;
    }
    if (
      !("PublicKeyCredential" in globalThis) ||
      !("isConditionalMediationAvailable" in PublicKeyCredential)
    ) {
      return;
    }
    let cancelled = false;
    void PublicKeyCredential.isConditionalMediationAvailable()
      .then((available) => {
        if (!cancelled && available) {
          setTwoFactorRedirectUrl(safeRedirectUrl);
          // Deliberately not routed through the button's mutation: the
          // conditional-mediation ceremony stays pending until the user picks
          // a passkey, which would leave the button stuck in its pending
          // (disabled) state.
          void authClient.signIn.passkey({
            autoFill: true,
            fetchOptions: {
              onSuccess: async (data) => {
                if (!cancelled) {
                  if (Schema.is(TwoFactorRedirectSchema)(data)) {
                    setTwoFactorRedirectUrl(safeRedirectUrl);
                    return;
                  }
                  await redirectAfterLogin();
                }
              },
            },
          });
        }
      })
      .catch(() => {
        // The browser does not support conditional mediation; the manual
        // button remains the fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [authClient, redirectAfterLogin, safeRedirectUrl]);

  const handleClick = () => {
    mutate(
      {},
      {
        onError: (error) => onError?.(error.message),
      },
    );
  };

  return (
    <Button
      disabled={isPending}
      onClick={handleClick}
      type="button"
      variant="outline"
    >
      <LuFingerprint />
      {isPending ? "Authenticating..." : "Sign in with passkey"}
    </Button>
  );
}
