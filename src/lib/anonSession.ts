const STORAGE_KEY = "aax_anon_session_id";

/**
 * A stable per-browser id used to tie an anonymous attempt to "whoever
 * comes back and signs in later" -- not identity, just enough continuity
 * to claim an attempt without asking for a retake. Falls back to an
 * in-memory id if localStorage is unavailable (private browsing, etc.);
 * the attempt still works, it just won't survive a page reload.
 */
export function getAnonSessionId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearAnonSessionId(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
