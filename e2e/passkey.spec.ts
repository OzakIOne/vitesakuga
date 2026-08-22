import { expect, test } from "@playwright/test";

const PASSWORD = "CorrectHorseBatteryStaple2026!";

test("registers a passkey and signs in with it", async ({ context, page }) => {
  const email = `passkey-${Date.now()}@test.local`;
  const signUp = await context.request.post("/api/auth/sign-up/email", {
    data: {
      callbackURL: "/",
      email,
      name: "Passkey Test User",
      password: PASSWORD,
    },
  });
  expect(signUp.ok()).toBeTruthy();

  // Drive the WebAuthn ceremony with a virtual authenticator (Chromium CDP).
  // `isUserVerified: true` skips the browser's user-verification prompt.
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      protocol: "ctap2",
      transport: "internal",
    },
  });

  await page.goto("/account");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await expect(page.getByRole("button", { name: "Add passkey" })).toBeVisible({
    timeout: 15000,
  });
  const addButton = page.getByRole("button", { name: "Add passkey" });
  for (let attempt = 0; attempt < 5; attempt++) {
    await addButton.click();
    try {
      // The button flips to "Registering..." once React's mutation is pending;
      // waiting for it proves the click actually reached the handler.
      await expect(
        page.getByRole("button", { name: "Registering..." }),
      ).toBeVisible({ timeout: 5000 });
      break;
    } catch {
      // Hydration race: retry the click.
    }
  }
  await expect(
    page.getByRole("button", { name: "Registering..." }),
  ).toBeVisible({ timeout: 10000 });

  // Registration completes and the refreshed list shows the new passkey row.
  await expect(page.getByText(/Added/)).toBeVisible({ timeout: 30000 });
  const listResponse = await context.request.get(
    "/api/auth/passkey/list-user-passkeys",
  );
  expect(listResponse.ok()).toBeTruthy();
  // SAFETY: Better Auth's list-user-passkeys endpoint returns the passkey
  // array directly (not wrapped in an object), so the JSON body is an array.
  const passkeys = (await listResponse.json()) as unknown[];
  expect(passkeys).toHaveLength(1);

  await context.request.post("/api/auth/sign-out");
  await context.clearCookies();

  // The login page auto-starts a conditional-mediation ceremony when
  // supported; disable it so the manual "Sign in with passkey" button drives
  // the test deterministically.
  await page.addInitScript(() => {
    try {
      if ("PublicKeyCredential" in window) {
        Object.defineProperty(
          PublicKeyCredential,
          "isConditionalMediationAvailable",
          {
            configurable: true,
            value: async () => false,
          },
        );
      }
    } catch {
      // The API surface may not exist in every environment; the manual button
      // below remains the primary assertion either way.
    }
  });

  await page.goto("/login");
  const signInButton = page.getByRole("button", {
    name: "Sign in with passkey",
  });
  await expect(signInButton).toBeVisible({ timeout: 15000 });

  for (let attempt = 0; attempt < 5; attempt++) {
    await signInButton.click();
    try {
      // The button flips to "Authenticating..." once the WebAuthn ceremony is
      // pending; waiting for it proves the click reached React.
      await expect(
        page.getByRole("button", { name: "Authenticating..." }),
      ).toBeVisible({ timeout: 5000 });
      break;
    } catch {
      // Hydration race: retry the click.
    }
  }
  await expect(
    page.getByRole("button", { name: "Authenticating..." }),
  ).toBeVisible({ timeout: 10000 });

  try {
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
      timeout: 20000,
    });
  } catch (error) {
    const serverError = await page
      .locator(".text-destructive")
      .textContent()
      .catch(() => null);
    throw new Error(
      `Passkey sign-in failed (url=${page.url()}, serverError=${serverError})`,
      { cause: error },
    );
  }
});
