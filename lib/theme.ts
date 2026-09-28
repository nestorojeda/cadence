export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

export const THEME_STORAGE_KEY = "apex_theme";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Must stay self-contained: it is serialized into the HTML, not bundled. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}})();`;
