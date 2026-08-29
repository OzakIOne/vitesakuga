import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Invisible Cloudflare Turnstile integration for the auth forms.
 *
 * Loads the Turnstile script (explicit render), mounts an invisible widget for
 * the given sitekey, and exposes an `execute()` that resolves to a fresh
 * verification token. The token is sent to Better Auth via the
 * `x-captcha-response` header and verified server-side by the captcha plugin.
 *
 * When no sitekey is configured, or the captcha is not required in the
 * current stage (local dev/test: the server never verifies the token), the
 * hook is a no-op and `execute()` resolves to `null` immediately, so forms
 * submit without waiting on a challenge.
 */

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** How long execute() waits (covering Turnstile's internal retries) before
 * giving up and resolving without a token. */
const EXECUTE_TIMEOUT_MS = 15_000;

/** Minimal client-side Turnstile JS API surface. */
export type TurnstileClient = {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      size?: "normal" | "compact" | "flexible";
      /**
       * Defer the challenge until `execute()` is called. Without this, an
       * invisible widget auto-runs its challenge on render and the later
       * `execute()` call throws ("widget is already executing").
       */
      execution?: "render" | "execute";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      /**
       * Without an error-callback, Turnstile throws an uncaught exception on
       * any widget error (e.g. 600010 from Private Access Token failures on
       * Brave/Chromium), even for transient errors that auto-retry.
       */
      "error-callback"?: (errorCode: string) => void;
    },
  ) => string;
  execute: (
    widgetId: string,
    params?: { callback?: (token: string) => void },
  ) => void;
  /** Clears the widget state (used before re-running a challenge). */
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- global augmentation must be an interface
  interface Window {
    turnstile?: TurnstileClient;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Turnstile"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function useTurnstile(sitekey: string | undefined, required: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sitekey || !required) {
      return;
    }
    let cancelled = false;
    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) {
          return;
        }
        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey,
          // No `size`: "invisible" is no longer a valid value (Turnstile now
          // only accepts "normal" | "compact" | "flexible"). Invisibility is
          // a property of the sitekey's widget mode, not a render option.
          execution: "execute",
          "error-callback": (errorCode) => {
            // Do NOT resolve the pending execute() here: 600* errors are
            // usually transient (Private Access Token failures, network) and
            // Turnstile auto-retries. Cancelling on the first error would
            // send the request without a captcha token, which the captcha
            // plugin (active whenever TURNSTILE_SECRET is set) rejects.
            // If the challenge never completes, execute()'s timeout resolves
            // with null instead of hanging the form forever.
            if (import.meta.env.DEV) {
              // surfacing the code (e.g. 600010 = PAT failure on Brave)
              console.warn(`Turnstile error: ${errorCode}`);
            }
            // Returning truthy marks the error as handled, so Turnstile does
            // not throw an uncaught TurnstileError.
            return true;
          },
        });
        widgetIdRef.current = widgetId;
        setReady(true);
      })
      .catch(() => {
        // Turnstile is best-effort: if the script fails to load, the captcha
        // plugin in production will reject the request, but we must not crash
        // the form in dev.
      });

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [required, sitekey]);

  const execute = useCallback(async (): Promise<string | null> => {
    const widgetId = widgetIdRef.current;
    if (!sitekey || !required || !widgetId || !window.turnstile) {
      return null;
    }
    // Reset first: if a previous challenge is still executing (e.g. after a
    // failed attempt whose 15s timeout already gave up on the token), calling
    // execute() again throws "widget is already executing". reset() clears
    // the stale challenge state so the widget starts fresh.
    window.turnstile.reset(widgetId);
    return new Promise<string | null>((resolve) => {
      // Failsafe: if the challenge never completes (persistent errors after
      // Turnstile's internal retries), resolve with null instead of hanging
      // the form. Without a token the captcha plugin rejects the request,
      // which is the intended outcome when the challenge genuinely fails.
      let settled = false;
      const finish = (token: string | null) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(token);
      };
      const timeout = setTimeout(() => finish(null), EXECUTE_TIMEOUT_MS);
      window.turnstile?.execute(widgetId, {
        callback: (token) => finish(token),
      });
    });
  }, [required, sitekey]);

  return { containerRef, execute, ready };
}
