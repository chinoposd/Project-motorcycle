const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidAuthEmail(value: string): boolean {
  return AUTH_EMAIL_PATTERN.test(normalizeAuthEmail(value));
}
