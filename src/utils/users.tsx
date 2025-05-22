import { queryOptions } from "@tanstack/react-query";
import { DatabaseSchema } from "~/db/schema";

export const DEPLOY_URL = "http://localhost:3000";

export const usersQueryOptions = () =>
  queryOptions({
    queryKey: ["users"],
    queryFn: () =>
      fetch(DEPLOY_URL + "/api/users")
        .then((r) => {
          if (!r.ok) {
            throw new Error("Failed to fetch users");
          }
          return r.json() as Promise<DatabaseSchema["users"][]>;
        })
        .catch(() => {
          throw new Error("Failed to fetch users");
        }),
  });
