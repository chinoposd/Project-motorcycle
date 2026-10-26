export function isValidAuthPassword(value: string): boolean {
  return value.length >= 9
    && value.length <= 256
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[\p{P}\p{S}]/u.test(value);
}
