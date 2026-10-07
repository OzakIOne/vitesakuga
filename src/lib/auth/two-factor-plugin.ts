const additionalSessionMintPaths = new Set([
  "/sign-in/email-otp",
  "/email-otp/verify-email",
  "/sign-up/email",
  "/callback/:id",
  "/passkey/verify-authentication",
]);

export const isAdditionalTwoFactorSessionMintPath = (path: string): boolean =>
  additionalSessionMintPaths.has(path);
