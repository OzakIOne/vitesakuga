import { loadServerEnv } from "./defs";
// Registers the real HTML sanitizer (sanitize-html) for the server runtime.
// Imported for its side effect — shared schemas decode user input through
// lib/sanitize, which is a client-safe pass-through until this registration
// runs. Must come before any schema decode can happen in a request.
import "../sanitize.server";

export const envServer = loadServerEnv(process.env);
