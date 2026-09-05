import { createHmac } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

const PASSWORD = "CorrectHorseBatteryStaple2026!";

test.setTimeout(120_000);

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(value: string): Buffer {
  const clean = value.replace(/=+$/u, "").toUpperCase();
  const bits = Array.from(clean)
    .map((char) => {
      const index = BASE32_ALPHABET.indexOf(char);
      if (index === -1) {
        throw new Error(`Invalid base32 character: ${char}`);
      }
      return index.toString(2).padStart(5, "0");
    })
    .join("");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** Standard TOTP (HMAC-SHA1, 30s step, 6 digits) — matches Better Auth. */
function totp(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const byte0 = digest[offset] ?? 0;
  const byte1 = digest[offset + 1] ?? 0;
  const byte2 = digest[offset + 2] ?? 0;
  const byte3 = digest[offset + 3] ?? 0;
  const binary =
    ((byte0 & 0x7f) << 24) |
    ((byte1 & 0xff) << 16) |
    ((byte2 & 0xff) << 8) |
    (byte3 & 0xff);

  return (binary % 1_000_000).toString().padStart(6, "0");
}

const signUp = async (request: APIRequestContext, email: string) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: {
      callbackURL: "/",
      email,
      name: "2FA Test User",
      password: PASSWORD,
    },
  });
  expect(
    response.ok(),
    `${await response.text()} retryAfter=${response.headers()["x-retry-after"]}`,
  ).toBeTruthy();
  return response;
};

const signOut = async (request: APIRequestContext, context: BrowserContext) => {
  await request.post("/api/auth/sign-out", {
    headers: { origin: "http://localhost:3100" },
  });
  await context.clearCookies();
};

const enableTwoFactorOnce = async (page: Page) => {
  await page.goto("/account");
  // Wait for hydration before interacting (see upload.spec.ts).
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.getByRole("button", { name: "Enable 2FA" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30000 });

  await dialog.getByPlaceholder("Enter your password").fill(PASSWORD);
  const continueButton = dialog.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  await expect(dialog.getByText("Scan the QR code")).toBeVisible({
    timeout: 30000,
  });
  const secret = (
    (await dialog.locator(".font-mono").first().textContent()) ?? ""
  ).trim();
  const codeInput = dialog.getByPlaceholder("000000");
  const verifyCodeButton = dialog.getByRole("button", { name: "Verify code" });
  for (let attempt = 0; attempt < 5; attempt++) {
    await codeInput.fill(totp(secret));
    try {
      await expect(verifyCodeButton).toBeEnabled({ timeout: 5000 });
      break;
    } catch {
      // React state had not picked up the fill yet; retry.
    }
  }
  await verifyCodeButton.click();

  try {
    await expect(dialog.getByText("Save your backup codes")).toBeVisible({
      timeout: 10000,
    });
  } catch {
    // The first click can be dropped while React is still settling; retry it.
    for (let attempt = 0; attempt < 3; attempt++) {
      await verifyCodeButton.click();
      try {
        await expect(dialog.getByText("Save your backup codes")).toBeVisible({
          timeout: 5000,
        });
        break;
      } catch {
        // Keep retrying.
      }
    }
    await expect(dialog.getByText("Save your backup codes")).toBeVisible({
      timeout: 10000,
    });
  }
  const backupCodes = await dialog.locator("code").allTextContents();
  expect(backupCodes.length).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "Done" }).click();
  return { backupCodes, secret };
};

/**
 * Enables 2FA through the account page UI: password step, QR code + TOTP
 * verification, then the backup-codes screen. Returns the displayed secret
 * (for later challenge verifications) and backup codes.
 */
const enableTwoFactorViaUi = async (page: Page) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await enableTwoFactorOnce(page);
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      // Vite dev can reload the page during first-time module compilation;
      // restart the flow. 2FA only activates once the code is verified, so
      // the "Enable 2FA" button is available again unless a previous attempt
      // actually completed — in which case the next attempt fails loudly.
      await page.goto("/account");
    }
  }
  throw new Error("Failed to enable two-factor authentication");
};

const signInViaUi = async (page: Page, email: string) => {
  await page.goto("/login");
  // The page is server-rendered; React hydration can lag behind paint. If the
  // submit handler is not attached yet, the form submits natively (GET with
  // the values in the query string) — retry from a fresh page in that case.
  const emailInput = page.locator("#email");
  const passwordInput = page.locator("#password");
  const loginButton = page.getByRole("button", { name: "Login", exact: true });

  for (let attempt = 0; attempt < 4; attempt++) {
    // Refill every attempt: hydration can reset the controlled email combobox
    // after an earlier fill, leaving React (and the form) with an empty value.
    await emailInput.fill(email);
    await passwordInput.fill(PASSWORD);
    await expect(emailInput).toHaveValue(email);
    await expect(passwordInput).toHaveValue(PASSWORD);

    await loginButton.click();
    try {
      await expect(page).toHaveURL(/\/two-factor/, { timeout: 20000 });
      // Best-effort wait for the route's client modules to finish compiling;
      // /two-factor loads no Turnstile, so networkidle settles once hydration
      // scripts are ready (unlike /login).
      await page
        .waitForLoadState("networkidle", { timeout: 20000 })
        .catch(() => undefined);
      return;
    } catch (error) {
      if (page.url().includes("?")) {
        // Native form submission: hydration had not finished. Reload and retry.
        await page.goto("/login");
        continue;
      }
      const serverError = await page
        .locator(".text-destructive")
        .textContent()
        .catch(() => null);
      if (serverError) {
        throw new Error(`Sign-in failed: ${serverError}`, { cause: error });
      }
      // No server error and no native submission: the mutation likely read a
      // reset email value. Refill and retry.
    }
  }

  throw new Error("Sign-in did not reach the 2FA page after repeated attempts");
};

/**
 * Fills the 2FA code input and waits for the React-controlled Verify button to
 * become enabled. If React has not hydrated yet, the fill is lost (the button
 * stays disabled), so this retries until the input event is actually handled.
 */
const enterChallengeCode = async (page: Page, input: Locator, code: string) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    await input.fill(code);
    try {
      await expect(page.getByRole("button", { name: "Verify" })).toBeEnabled({
        timeout: 5000,
      });
      return;
    } catch {
      // React had not hydrated yet; retry the fill.
      if (attempt === 2) {
        // Hydration looks stuck on this document; reload the challenge page.
        // The pending 2FA challenge lives in a cookie, so it survives reload.
        await page.reload();
        await expect(page).toHaveURL(/\/two-factor/, { timeout: 15000 });
        input = page.getByPlaceholder("000000");
      }
    }
  }
  throw new Error("Verify button never enabled after entering the code");
};

test("signs in with a TOTP code after enabling 2FA", async ({
  context,
  page,
}) => {
  const email = `2fa-totp-${Date.now()}@test.local`;
  await signUp(context.request, email);
  const { secret } = await enableTwoFactorViaUi(page);
  await signOut(context.request, context);

  await signInViaUi(page, email);

  const codeInput = page.getByPlaceholder("000000");
  await expect(codeInput).toBeVisible({ timeout: 30000 });
  await enterChallengeCode(page, codeInput, "000000");

  // A wrong code surfaces the server error instead of signing in.
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 10000 });

  await enterChallengeCode(page, codeInput, totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page).not.toHaveURL(/\/two-factor/);
});

test("signs in with a backup code when the authenticator code is unavailable", async ({
  context,
  page,
}) => {
  const email = `2fa-backup-${Date.now()}@test.local`;
  await signUp(context.request, email);
  const { backupCodes } = await enableTwoFactorViaUi(page);
  await signOut(context.request, context);

  await signInViaUi(page, email);

  const codeInput = page.getByPlaceholder("000000");
  await expect(codeInput).toBeVisible({ timeout: 30000 });
  await enterChallengeCode(page, codeInput, "000000");

  const backupToggle = page.getByRole("button", {
    name: "Use a backup code instead",
  });
  const backupCodeInput = page.getByPlaceholder("Enter backup code");
  for (let attempt = 0; attempt < 3; attempt++) {
    await backupToggle.click();
    try {
      await expect(backupCodeInput).toBeVisible({ timeout: 5000 });
      break;
    } catch {
      // Hydration race: the click landed before React attached the handler.
    }
  }
  await expect(backupCodeInput).toBeVisible();
  await backupCodeInput.fill(backupCodes[0] ?? "");
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
    timeout: 15000,
  });
});
