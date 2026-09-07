/**
 * Email domains accepted for new accounts.
 *
 * This is intentionally an exact allow-list. In particular, do not replace
 * the equality check with `endsWith(domain)`: `gmail.com.example.org` is not
 * a Gmail address. Provider aliases and relay domains are listed explicitly
 * so privacy-preserving addresses such as Apple Private Relay remain usable.
 */
export const TRUSTED_EMAIL_DOMAINS = [
  // Google
  "gmail.com",
  "googlemail.com",
  // Microsoft
  "hotmail.com",
  "live.com",
  "msn.com",
  "outlook.com",
  // Yahoo / AOL
  "aol.com",
  "yahoo.com",
  "ymail.com",
  // Apple, including aliases and Private Relay
  "icloud.com",
  "mac.com",
  "me.com",
  "privaterelay.appleid.com",
  // GitHub's privacy-preserving noreply addresses
  "users.noreply.github.com",
  // Privacy-focused providers and relay services
  "addy.io",
  "anonaddy.com",
  "anonaddy.me",
  "duck.com",
  "fastmail.com",
  "fastmail.fm",
  "hey.com",
  "relay.firefox.com",
  "simplelogin.com",
  "simplelogin.io",
  // Other established mailbox providers
  "gmx.com",
  "mail.com",
  "proton.me",
  "protonmail.ch",
  "protonmail.com",
  "pm.me",
  "tuta.com",
  "tuta.io",
  "tutamail.com",
  "tutanota.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "zohomail.com",
] as const;

const trustedEmailDomains = new Set<string>(TRUSTED_EMAIL_DOMAINS);

export const EMAIL_DOMAIN_POLICY_MESSAGE =
  "Please use an email address from a supported provider.";

export function emailDomain(email: string): string | undefined {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) {
    return undefined;
  }
  return email
    .slice(atIndex + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/u, "");
}

export function isTrustedEmailDomain(domain: string): boolean {
  return trustedEmailDomains.has(
    domain.trim().toLowerCase().replace(/\.$/u, ""),
  );
}

export function isAllowedSignupEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain !== undefined && isTrustedEmailDomain(domain);
}
