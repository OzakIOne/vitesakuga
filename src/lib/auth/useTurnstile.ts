import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Invisible Cloudflare Turnstile integration for the auth forms.
 *
 * Loads the Turnstile script (explicit render), mounts an invisible widget for
 * the given sitekey, and exposes an `execute()` that resolves to a fresh
 * verification token. The token is sent to Better Auth via the
 * `x-captcha-response` header and verified server-side by the captcha plugin.
 *
 * When no sitekey is configured (dev/test), the hook is a no-op and
 * `execute()` resolves to `null`, so existing flows keep working.
 */

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Minimal client-side Turnstile JS API surface. */
export type TurnstileClient = {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      size?: "normal" | "compact" | "invisible";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  execute: (
    widgetId: string,
    params?: { callback?: (token: string) => void },
  ) => void;
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

export function useTurnstile(sitekey: string | undefined) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sitekey) {
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
          size: "invisible",
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
  }, [sitekey]);

  const execute = useCallback(async (): Promise<string | null> => {
    const widgetId = widgetIdRef.current;
    if (!sitekey || !widgetId || !window.turnstile) {
      return null;
    }
    return new Promise<string>((resolve) => {
      window.turnstile?.execute(widgetId, {
        callback: (token) => resolve(token),
      });
    });
  }, [sitekey]);

  return { containerRef, execute, ready };
}
