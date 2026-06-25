/**
 * Returns true if the value is empty (optional field) or a valid http/https URL.
 * Rejects javascript:, data:, blob:, and every other non-HTTP scheme.
 */
export function isValidHttpUrl(value: string): boolean {
  if (!value || !value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns a safe href for use in <a> tags.
 * Falls back to "#" for any non-http(s) URL so javascript: links never reach the DOM.
 */
export function safeHref(value: string | null | undefined): string {
  if (!value || !value.trim()) return "#";
  return isValidHttpUrl(value) ? value.trim() : "#";
}
