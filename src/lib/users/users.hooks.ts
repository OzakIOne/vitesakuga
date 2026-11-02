import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { usersKeys } from "./users.queries";

export const useRefreshUserInfo = () => {
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: usersKeys.userInfo,
        refetchType: "all",
      }),
    [queryClient],
  );
};
