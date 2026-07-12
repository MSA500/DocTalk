export const SESSION_COOKIE = "doctalk-session";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(value: string | undefined | null): value is string {
  return !!value && UUID_PATTERN.test(value);
}
