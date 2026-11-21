import { createServerFn } from "@tanstack/react-start";

import { createEndpointHandler } from "../server-endpoint";
import { resolveMiddlewareLayer } from "../server-fn.handler";
import { SessionService } from "./session.effect";

export const getUserSessionContext = createServerFn().handler(
  createEndpointHandler({
    service: SessionService,
    operation: "getClientSession",
    base: resolveMiddlewareLayer,
  }),
);
