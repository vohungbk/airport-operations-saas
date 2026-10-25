import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY, oppositeTheme } from "@/lib/theme/theme";
import { createThemeStore, type ThemeStorage } from "@/lib/theme/theme-store";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: ThemeStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
  return { storage, data };
}

function fakeMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches,
    addEventListener: (_: "change", l: () => void) => void listeners.add(l),
    removeEventListener: (_: "change", l: () => void) => void listeners.delete(l),
    /** The device setting changes. */
    set(next: boolean) {
      this.matches = next;
      listeners.forEach((l) => l());
    },
    count: () => listeners.size,
  };
}

function fakeRoot() {
  const classes = new Set<string>();
  return {
    classList: {
      toggle: (token: string, force: boolean) => {
        if (force) classes.add(token);
        else classes.delete(token);
      },
    },
    isDark: () => classes.has("dark"),
  };
}

function setup(options: { saved?: string; deviceDark?: boolean; storage?: ThemeStorage | null } = {}) {
  const { storage, data } = fakeStorage(
    options.saved === undefined ? {} : { [THEME_STORAGE_KEY]: options.saved },
  );
  const media = fakeMedia(options.deviceDark ?? false);
  const root = fakeRoot();
  const store = createThemeStore({
    storage: options.storage === undefined ? storage : options.storage,
    media,
    root,
  });
  return { store, data, media, root, storage };
}

describe("theme store: choosing a theme", () => {
  it("should add the dark class when Dark is selected and remove it when Light is selected", () => {
    const { store, root } = setup();

    store.setTheme("dark");
    expect(root.isDark()).toBe(true);
    expect(store.getState()).toMatchObject({ theme: "dark", resolved: "dark" });

    store.setTheme("light");
    expect(root.isDark()).toBe(false);
  });

  it("should save the choice on the device", () => {
    const { store, data } = setup();

    store.setTheme("dark");

    expect(data.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(store.getState().saved).toBe(true);
  });

  it("should tell the listeners when the theme changes", () => {
    const { store } = setup();
    let calls = 0;
    store.subscribe(() => calls++);

    store.setTheme("dark");

    expect(calls).toBe(1);
  });

  it("should keep the same state object while nothing changes", () => {
    const { store } = setup();

    expect(store.getState()).toBe(store.getState());
  });
});

describe("theme store: first load", () => {
  it("should start with System and follow a dark device when nothing is saved", () => {
    const { store, root } = setup({ deviceDark: true });

    expect(store.getState()).toMatchObject({ theme: "system", resolved: "dark" });
    expect(root.isDark()).toBe(true);
  });

  it("should start with the saved theme", () => {
    const { store, root } = setup({ saved: "dark", deviceDark: false });

    expect(store.getState().theme).toBe("dark");
    expect(root.isDark()).toBe(true);
  });

  it("should use System and replace the saved value when it is invalid", () => {
    const { store, data } = setup({ saved: "purple" });

    expect(store.getState().theme).toBe("system");
    expect(data.get(THEME_STORAGE_KEY)).toBe("system");
  });

  it("should keep the choice after a reload", () => {
    const first = setup();
    first.store.setTheme("dark");

    const media = fakeMedia(false);
    const root = fakeRoot();
    const second = createThemeStore({ storage: first.storage, media, root });

    expect(second.getState().theme).toBe("dark");
    expect(root.isDark()).toBe(true);
  });
});

describe("theme store: System follows the device", () => {
  it("should change the theme when the device setting changes while System is chosen", () => {
    const { store, media, root } = setup({ deviceDark: false });
    store.subscribe(() => {});

    media.set(true);
    expect(root.isDark()).toBe(true);
    expect(store.getState().resolved).toBe("dark");

    media.set(false);
    expect(root.isDark()).toBe(false);
  });

  it("should ignore a device change when Light or Dark is chosen", () => {
    const { store, media, root } = setup({ saved: "light" });
    store.subscribe(() => {});

    media.set(true);

    expect(root.isDark()).toBe(false);
    expect(store.getState().theme).toBe("light");
  });

  it("should listen to the device only while someone is subscribed", () => {
    const { store, media } = setup();

    const stop = store.subscribe(() => {});
    expect(media.count()).toBe(1);

    stop();
    expect(media.count()).toBe(0);
  });
});

describe("theme store: storage that fails", () => {
  const throwing: ThemeStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };

  it("should still apply the theme and report it was not saved when writing throws", () => {
    const { store, root } = setup({ storage: throwing });

    store.setTheme("dark");

    expect(root.isDark()).toBe(true);
    expect(store.getState()).toMatchObject({ theme: "dark", saved: false });
  });

  it("should start with System when reading throws", () => {
    const { store } = setup({ storage: throwing });

    expect(store.getState().theme).toBe("system");
  });

  it("should work with no storage at all", () => {
    const { store } = setup({ storage: null });

    store.setTheme("light");

    expect(store.getState()).toMatchObject({ theme: "light", saved: false });
  });
});

describe("theme store: another tab", () => {
  it("should follow a choice saved in another tab without writing it back", () => {
    const { store, root, data } = setup();

    store.handleStorageEvent({ key: THEME_STORAGE_KEY, newValue: "dark" });

    expect(store.getState().theme).toBe("dark");
    expect(root.isDark()).toBe(true);
    expect(data.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it("should ignore a change to another key", () => {
    const { store } = setup({ saved: "light" });

    store.handleStorageEvent({ key: "other", newValue: "dark" });

    expect(store.getState().theme).toBe("light");
  });

  it("should fall back to System when the saved value is cleared in another tab", () => {
    const { store } = setup({ saved: "dark" });

    store.handleStorageEvent({ key: THEME_STORAGE_KEY, newValue: null });

    expect(store.getState().theme).toBe("system");
  });
});

describe("theme toggle", () => {
  it("should leave a dark device on dark by default and save nothing until the first press", () => {
    const { store, data } = setup({ deviceDark: true });

    expect(store.getState()).toMatchObject({ theme: "system", resolved: "dark" });
    expect(data.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it("should save an explicit light on the first press from a dark device", () => {
    const { store, data, root } = setup({ deviceDark: true });

    store.setTheme(oppositeTheme(store.getState().resolved));

    expect(store.getState()).toMatchObject({ theme: "light", resolved: "light" });
    expect(data.get(THEME_STORAGE_KEY)).toBe("light");
    expect(root.isDark()).toBe(false);
  });

  it("should stay on the pressed theme when the device changes after it", () => {
    const { store, media, root } = setup({ deviceDark: false });
    store.subscribe(() => {});

    store.setTheme(oppositeTheme(store.getState().resolved));
    media.set(false);

    expect(root.isDark()).toBe(true);
  });
});

describe("theme journey", () => {
  it("should go Light, Dark, System and keep System after a reload", () => {
    const { store, media, root, storage } = setup({ deviceDark: false });
    store.subscribe(() => {});

    store.setTheme("light");
    expect(root.isDark()).toBe(false);

    store.setTheme("dark");
    expect(root.isDark()).toBe(true);

    store.setTheme("system");
    expect(root.isDark()).toBe(false);
    media.set(true);
    expect(root.isDark()).toBe(true);

    const reloaded = createThemeStore({ storage, media: fakeMedia(true), root: fakeRoot() });
    expect(reloaded.getState()).toMatchObject({ theme: "system", resolved: "dark" });
  });
});
