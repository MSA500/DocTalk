export const THEME_COOKIE = "doctalk-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

export function isValidTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}
