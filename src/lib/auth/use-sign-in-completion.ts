import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { useCallback, useMemo } from "react";
import { usersKeys } from "src/lib/users/users.queries";

import { getSafeAuthRedirectUrl } from "./auth-redirect";
import {
  clearTwoFactorRedirectUrl,
  setTwoFactorRedirectUrl,
} from "./two-factor.hooks";
import { TwoFactorRedirectSchema } from "./two-factor.schema";

type SignInResponse =
  | { readonly status: boolean; readonly token: string | null }
  | {
      readonly session: {
        readonly id: string;
        readonly userId: string;
      };
      readonly user: { readonly id: string };
    }
  | Schema.Schema.Type<typeof TwoFactorRedirectSchema>;

export const useSignInCompletion = (redirectUrl: string) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const safeRedirectUrl = getSafeAuthRedirectUrl(redirectUrl);

  const begin = useCallback(() => {
    setTwoFactorRedirectUrl(safeRedirectUrl);
  }, [safeRedirectUrl]);

  const complete = useCallback(
    async (response: SignInResponse): Promise<void> => {
      if (Schema.is(TwoFactorRedirectSchema)(response)) {
        setTwoFactorRedirectUrl(safeRedirectUrl);
        return;
      }

      clearTwoFactorRedirectUrl();
      await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
      await navigate({ to: safeRedirectUrl });
    },
    [navigate, queryClient, safeRedirectUrl],
  );

  const fail = useCallback(() => {
    clearTwoFactorRedirectUrl();
  }, []);

  return useMemo(
    () => ({ begin, complete, fail, safeRedirectUrl }),
    [begin, complete, fail, safeRedirectUrl],
  );
};
