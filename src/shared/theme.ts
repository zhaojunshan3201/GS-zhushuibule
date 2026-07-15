export const THEME_STORAGE_KEY = "gszhushui_theme";
export const DEFAULT_THEME = "default" as const;

export const THEME_OPTIONS = [
  { key: "default", label: "当前默认主题" },
  { key: "oil-blue", label: "中石油红" },
  { key: "enterprise-white", label: "极简企业白" },
  { key: "emerald-gold", label: "墨绿鎏金" },
] as const;

export type ThemeKey = (typeof THEME_OPTIONS)[number]["key"];

export function isThemeKey(value: string | null): value is ThemeKey {
  return THEME_OPTIONS.some((theme) => theme.key === value);
}

export function getStoredTheme(value: string | null): ThemeKey {
  return isThemeKey(value) ? value : DEFAULT_THEME;
}

export function safeGetTheme(storage: Pick<Storage, "getItem"> | null | undefined): ThemeKey {
  try {
    return getStoredTheme(storage?.getItem(THEME_STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_THEME;
  }
}

export function safePersistTheme(storage: Pick<Storage, "setItem"> | null | undefined, theme: ThemeKey): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
}

export function getBrowserTheme(): ThemeKey {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return safeGetTheme(window.localStorage);
  } catch {
    return DEFAULT_THEME;
  }
}

export function persistBrowserTheme(theme: ThemeKey): void {
  if (typeof window === "undefined") return;
  try {
    safePersistTheme(window.localStorage, theme);
  } catch {
    // Storage can be unavailable before its methods are accessed.
  }
}
