import { DARK_CLASS, DARK_MEDIA_QUERY, THEME_STORAGE_KEY } from "@/lib/theme/theme";

/**
 * UI-F01-S03 (spec R9): runs in the `<head>` before the first paint, so the saved theme is on
 * the page before anything is drawn and the wrong theme never flashes. It repeats the rule of
 * `parseStoredTheme` and `resolveTheme` in plain JavaScript: only `dark` and `light` count as a
 * choice, anything else follows the device. It never throws; with storage blocked the page keeps
 * its default look (E1).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(DARK_MEDIA_QUERY)}).matches);document.documentElement.classList.toggle(${JSON.stringify(DARK_CLASS)},d)}catch(e){}})()`;
