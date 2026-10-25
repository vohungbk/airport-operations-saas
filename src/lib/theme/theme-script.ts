import {
  DARK_CLASS,
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
} from "@/lib/theme/theme";

/**
 * UI-F01-S03 / S04 (spec R9, E1, E2): runs in the `<head>` before the first paint, so the saved
 * theme is on the page before anything is drawn and the wrong theme never flashes. It repeats the
 * rule of `parseStoredTheme` and `resolveTheme` in plain JavaScript: `dark` and `light` are a
 * choice, anything else follows the device. A value that is there but is not one of the three is
 * replaced by System, on every page, also on a page that has no theme control. A missing value is
 * left alone. It never throws; with storage blocked the page keeps its default look.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!==null&&${JSON.stringify(THEMES)}.indexOf(t)<0){t=${JSON.stringify(DEFAULT_THEME)};try{localStorage.setItem(k,t)}catch(e){}}var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(DARK_MEDIA_QUERY)}).matches);document.documentElement.classList.toggle(${JSON.stringify(DARK_CLASS)},d)}catch(e){}})()`;
