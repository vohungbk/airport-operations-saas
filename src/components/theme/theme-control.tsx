"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { useTheme } from "@/components/theme/use-theme";
import { Button } from "@/components/ui/button";
import { SHELL_BUTTON_FOCUS } from "@/lib/layout/focus";
import { oppositeTheme, themeStatusMessage } from "@/lib/theme/theme";

/**
 * UI-F01-S03: a button that switches between Light and Dark. It shows the icon of the theme it
 * will switch to: the moon while the page is light, the sun while it is dark. Until the user
 * presses it the theme follows the device (System); the first press saves an explicit choice on
 * the device. The icons are shown or hidden by the `dark` class, so the right one is there from
 * the first paint, before the page has loaded its script. States: Loading (disabled until the saved
 * choice is read), Success (announced), Error (the choice applies but could not be saved).
 * It has no permission check: every role, and a signed-out visitor, may use it.
 */
export function ThemeControl() {
  const { resolved, saved, ready, setTheme } = useTheme();
  // The result is announced only after a press, not each time a page loads.
  const [pressed, setPressed] = useState(false);
  const next = oppositeTheme(resolved);
  const label = ready ? `Switch to ${next} theme` : "Switch theme";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={!ready}
        aria-busy={!ready}
        aria-label={label}
        title={label}
        className={SHELL_BUTTON_FOCUS}
        onClick={() => {
          setTheme(next);
          setPressed(true);
        }}
      >
        <Moon aria-hidden="true" className="dark:hidden" />
        <Sun aria-hidden="true" className="hidden dark:block" />
      </Button>
      <span role="status" className="sr-only">
        {ready && pressed ? themeStatusMessage(next, saved) : ""}
      </span>
    </>
  );
}
