export const THEME_STORAGE_KEY = "gszhushui_theme";
export const DEFAULT_THEME = "default" as const;

export const THEME_OPTIONS = [
  { key: "default", label: "当前默认主题" },
  { key: "oil-blue", label: "专业油田蓝" },
  { key: "enterprise-white", label: "极简企业白" },
  { key: "industrial-dark", label: "深色工业台" },
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
