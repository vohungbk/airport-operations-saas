import { ThemeControl } from "@/components/theme/theme-control";

/**
 * The theme control in the top right corner of a sign-in page. The sign in page itself does not
 * show it: its design has none.
 */
export function AuthThemeControl() {
  return (
    <div className="absolute top-4 right-4 print:hidden">
      <ThemeControl />
    </div>
  );
}
