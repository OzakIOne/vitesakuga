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
