// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

import DarkModeSwitch from "../src/app/components/DarkModeSwitch.svelte";
import { ui } from "../src/app/ui.svelte";

beforeEach(() => {
  ui.themeMode = "system";
});

afterEach(() => cleanup());

describe("DarkModeSwitch", () => {
  it("offers all three theme choices", () => {
    render(DarkModeSwitch);

    for (const label of ["System", "Light", "Dark"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("selects the current mode", () => {
    ui.themeMode = "dark";
    render(DarkModeSwitch);

    // the selected button is the one carrying the raised pill classes
    const dark = screen.getByRole("button", { name: "Dark" });
    expect(dark.className).toContain("bg-surface-50-950");

    const light = screen.getByRole("button", { name: "Light" });
    expect(light.className).not.toContain("bg-surface-50-950");
  });

  it("changes the theme when a choice is clicked", async () => {
    render(DarkModeSwitch);

    screen.getByRole("button", { name: "Light" }).click();
    expect(ui.themeMode).toBe("light");

    screen.getByRole("button", { name: "Dark" }).click();
    expect(ui.themeMode).toBe("dark");

    screen.getByRole("button", { name: "System" }).click();
    expect(ui.themeMode).toBe("system");
  });

  it("labels the buttons for screen readers and tooltips", () => {
    render(DarkModeSwitch);
    const light = screen.getByRole("button", { name: "Light" });
    expect(light.getAttribute("title")).toBe("Light");
    expect(light.getAttribute("aria-label")).toBe("Light");
  });

  it("marks exactly one mode as selected at a time", () => {
    ui.themeMode = "light";
    render(DarkModeSwitch);

    const selected = ["System", "Light", "Dark"].filter((label) =>
      screen
        .getByRole("button", { name: label })
        .className.includes("bg-surface-50-950"),
    );

    expect(selected).toEqual(["Light"]);
  });
});
