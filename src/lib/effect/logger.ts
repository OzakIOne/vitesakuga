import { Layer, References } from "effect";

type LogLevel =
  | "All"
  | "Fatal"
  | "Error"
  | "Warn"
  | "Info"
  | "Debug"
  | "Trace"
  | "None";

export const withMinimumLogLevel = (level: LogLevel) =>
  Layer.succeed(References.MinimumLogLevel)(level);

export const All = "All" as const;
export const Fatal = "Fatal" as const;
export const Error = "Error" as const;
export const Warn = "Warn" as const;
export const Info = "Info" as const;
export const Debug = "Debug" as const;
export const Trace = "Trace" as const;
export const None = "None" as const;
