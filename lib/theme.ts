/** The athlete's color mode choice; "system" follows the OS setting. */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

/** Kept under the legacy `apex_` prefix like every other saved setting. */
export const THEME_STORAGE_KEY = "apex_theme";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs inline in <head> before first paint so the page never flashes the wrong palette.
 * Must stay self-contained: it is serialized into the HTML, not bundled.
 * The hook that changes the mode is `useTheme` in components/ThemeToggle.tsx (client-only).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}})();`;
