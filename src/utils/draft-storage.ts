/**
 * Best-effort localStorage persistence for form drafts. Unlike TanStack DB
 * collections, this avoids the optimistic-mutation pipeline entirely — draft
 * text is plain local state with a storage side-effect.
 */

export function readStoredDraft<T extends object>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    // SAFETY: these keys only ever hold objects written by `writeStoredDraft`;
    // corrupted or missing payloads fall through to the catch below.
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Corrupted or unavailable storage — treat as no draft.
    return null;
  }
}

export function writeStoredDraft<T extends object>(
  key: string,
  value: T,
): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage unavailable — draft persistence is best-effort.
  }
}

export function removeStoredDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing to clean up.
  }
}
